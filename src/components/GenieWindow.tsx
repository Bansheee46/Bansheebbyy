import { useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { motion } from "motion/react";
import { toCanvas } from "html-to-image";
import type { CSSProperties, ReactNode } from "react";
import { clamp, lerp } from "@/lib/genie-math";
import { renderGenie, type Dir, type Pt } from "@/lib/genie-renderer";
import { CursorIcon } from "@/components/ui/CursorIcon";

// ─── Layout constants ────────────────────────────────────────────────────────
const DUR = 460;
const FULL_W = 520;
const DOCK_W = FULL_W;
const DOCK_H = 370;
const DOCK_LEFT = 16;
const CONTENT_TOP = 76;
const DOCK_TOP = CONTENT_TOP + 16;
const GRAB_X = 24;
const GRAB_Y = 28;

const slugify = (s: string) =>
  s.replace(/\/$/, "").replace(/\.md$/i, "").toLowerCase();

export default function GenieWindow({
  open,
  dock,
  width = FULL_W,
  onCloseComplete,
  onNavReady,
  children,
}: {
  open: boolean;
  dock?: boolean;
  width?: number;
  onCloseComplete?: () => void;
  onNavReady?: () => void;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [cursor, setCursor] = useState({
    x: 0,
    y: 0,
    visible: false,
    grabbing: false,
  });
  const [consoleOffset, setConsoleOffset] = useState({ x: 0, y: 0 });
  const [cursorInstant, setCursorInstant] = useState(false);
  const [placeholder, setPlaceholder] = useState<{
    x: number;
    y: number;
    items: string[];
  } | null>(null);
  const [ghost, setGhost] = useState<{
    text: string;
    x: number;
    y: number;
    color?: string;
    size?: number;
    bg?: string;
  } | null>(null);
  const [ghostFading, setGhostFading] = useState(false);
  const [centerText, setCenterText] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const realMouse = useRef({ x: 0, y: 0 });

  const setNativeCursorHidden = (hidden: boolean) => {
    document.body.classList.toggle("hide-cursor", hidden);
    document.documentElement.classList.toggle("hide-cursor", hidden);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const takeoverTimers = useRef<number[]>([]);
  const takeoverRaf = useRef(0);
  const takeoverActive = useRef(false);
  const finalCycle = useRef(false);

  const clearTakeover = () => {
    takeoverTimers.current.forEach((t) => clearTimeout(t));
    takeoverTimers.current = [];
    if (takeoverRaf.current) cancelAnimationFrame(takeoverRaf.current);
    takeoverRaf.current = 0;
    window.getSelection()?.removeAllRanges();
  };

  const selectNavLine = (node: Text | null, len: number, p: number) => {
    if (!node || len <= 0) return;
    const sel = window.getSelection();
    if (!sel) return;
    const end = Math.max(0, Math.min(len, Math.floor(len * p)));
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, end);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const collectTextNodes = (el: HTMLElement): Text[] => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const out: Text[] = [];
    let n = walker.nextNode();
    while (n) {
      out.push(n as Text);
      n = walker.nextNode();
    }
    return out;
  };

  // ─── runTakeover: automated cursor that selects nav → carries to bottom →
  //     selects intro → carries to centre → triggers closing ──────────────────
  const runTakeover = () => {
    const root = windowRef.current;
    const navEl = root?.querySelector<HTMLElement>("[data-nav-line]");
    if (!navEl || !root) {
      setNativeCursorHidden(false);
      return;
    }
    takeoverTimers.current = [];
    takeoverActive.current = true;
    setGhostFading(false);
    setCenterText(null);
    setNativeCursorHidden(true);
    const rect = navEl.getBoundingClientRect();
    const startX = rect.left + 2;
    const startY = rect.top + rect.height / 2;
    const endX = rect.right - 4;
    const endY = rect.top + rect.height / 2;
    const textNode = navEl.firstChild as Text | null;
    const len = textNode?.textContent?.length ?? 0;
    const navText = navEl.textContent ?? "";

    const push = (t: number) => {
      takeoverTimers.current.push(t);
      return t;
    };

    // 1. Glide to the start of the nav line.
    setCursorInstant(false);
    setCursor({ x: startX, y: startY, visible: true, grabbing: false });

    // 2. Press down.
    push(
      window.setTimeout(() => {
        setCursor({ x: startX, y: startY, visible: true, grabbing: true });
      }, 1000),
    );

    // 3. Drag across, selecting the text.
    const dragStart = 1000;
    const dragDur = 1400;
    push(
      window.setTimeout(() => {
        setCursorInstant(true);
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / dragDur);
          const x = startX + (endX - startX) * p;
          const y = startY + (endY - startY) * p;
          setCursor({ x, y, visible: true, grabbing: true });
          selectNavLine(textNode, len, p);
          if (p < 1) takeoverRaf.current = requestAnimationFrame(step);
        };
        takeoverRaf.current = requestAnimationFrame(step);
      }, dragStart),
    );

    // 5. Release, then pick up.
    push(
      window.setTimeout(() => {
        setCursor({ x: endX, y: endY, visible: true, grabbing: false });
      }, dragStart + dragDur + 160),
    );
    push(
      window.setTimeout(() => {
        setCursorInstant(true);
        setCursor({ x: endX, y: endY, visible: true, grabbing: true });
      }, dragStart + dragDur + 450),
    );

    // 6. Carry the selection down to bottom-center.
    const carryStart = dragStart + dragDur + 320;
    const carryDur = 1200;
    const dropX = window.innerWidth / 2;
    const dropY = window.innerHeight - 56;
    push(
      window.setTimeout(() => {
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / carryDur);
          const x = endX + (dropX - endX) * p;
          const y = endY + (dropY - endY) * p;
          setCursor({ x, y, visible: true, grabbing: true });
          if (navText) setGhost({ text: navText, x: x + 10, y: y + 10 });
          if (p < 1) takeoverRaf.current = requestAnimationFrame(step);
        };
        takeoverRaf.current = requestAnimationFrame(step);
      }, carryStart),
    );

    // 7. Drop — ghost fades, placeholder appears.
    push(
      window.setTimeout(() => {
        setCursor({ x: dropX, y: dropY, visible: true, grabbing: false });
        setGhostFading(true);
        window.getSelection()?.removeAllRanges();
        setPlaceholder({
          x: dropX,
          y: dropY,
          items: navText.split(/\s+/).filter(Boolean),
        });
        onNavReady?.();
        push(window.setTimeout(() => setGhost(null), 300));
      }, carryStart + carryDur),
    );

    // 8. Fly back, select intro block.
    const restAt = carryStart + carryDur + 450;
    push(
      window.setTimeout(() => {
        const host = windowRef.current;
        const introEls = host
          ? Array.from(host.querySelectorAll<HTMLElement>("[data-intro-line]"))
          : [];
        if (introEls.length === 0) return;
        const rects = introEls.map((el) => el.getBoundingClientRect());
        const firstR = rects[0];
        const lastR = rects[rects.length - 1];
        const lineTextEnd = (el: HTMLElement): { x: number; y: number } => {
          const r = document.createRange();
          r.selectNodeContents(el);
          const rs = r.getClientRects();
          const rect = rs[rs.length - 1];
          return rect
            ? { x: rect.right, y: rect.top + rect.height / 2 }
            : {
                x: el.getBoundingClientRect().right,
                y:
                  el.getBoundingClientRect().top +
                  el.getBoundingClientRect().height / 2,
              };
        };
        const firstEnd = lineTextEnd(introEls[0]);
        const lastEnd = lineTextEnd(introEls[introEls.length - 1]);
        const lineRight = Math.max(...rects.map((r) => r.right));
        const allNodes = introEls.flatMap((el) => collectTextNodes(el));
        const anchorNode = allNodes[0];
        if (!anchorNode) return;

        const sx = firstR.left + 2;
        const sy = firstR.top + firstR.height / 2;

        setCursorInstant(false);
        setCursor({ x: sx, y: sy, visible: true, grabbing: false });

        const pressAt = 900;
        push(
          window.setTimeout(() => {
            setCursor({ x: sx, y: sy, visible: true, grabbing: true });
          }, pressAt),
        );

        const dragStart2 = pressAt;
        const single = introEls.length <= 1;
        const dragDur2 = single ? 1400 : 2500;
        const phaseA = 0.32;
        const caretAt = (
          x: number,
          y: number,
        ): { node: Node; offset: number } | null => {
          const d = document as Document & {
            caretRangeFromPoint?: (x: number, y: number) => Range | null;
            caretPositionFromPoint?: (
              x: number,
              y: number,
            ) => { offsetNode: Node; offset: number } | null;
          };
          if (d.caretRangeFromPoint) {
            const r = d.caretRangeFromPoint(x, y);
            return r ? { node: r.startContainer, offset: r.startOffset } : null;
          }
          if (d.caretPositionFromPoint) {
            const c = d.caretPositionFromPoint(x, y);
            return c ? { node: c.offsetNode, offset: c.offset } : null;
          }
          return null;
        };
        push(
          window.setTimeout(() => {
            setCursorInstant(true);
            const t0 = performance.now();
            const step = (now: number) => {
              const p = Math.min(1, (now - t0) / dragDur2);
              let cx: number, cy: number;
              if (single) {
                cx = lerp(firstR.left + 2, firstEnd.x - 2, p);
                cy = firstR.top + firstR.height / 2;
              } else if (p < phaseA) {
                const t = p / phaseA;
                cx = lerp(firstR.left + 2, firstEnd.x - 2, t);
                cy = firstR.top + firstR.height / 2;
              } else {
                const t = (p - phaseA) / (1 - phaseA);
                cx = lineRight - 2;
                cy = lerp(
                  firstR.top + firstR.height / 2,
                  lastR.top + lastR.height / 2,
                  t,
                );
              }
              setCursor({ x: cx, y: cy, visible: true, grabbing: true });
              const cp = caretAt(cx, cy);
              if (cp) {
                const sel = window.getSelection();
                if (sel) {
                  const range = document.createRange();
                  range.setStart(anchorNode, 0);
                  range.setEnd(cp.node, cp.offset);
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
              }
              if (p < 1) takeoverRaf.current = requestAnimationFrame(step);
            };
            takeoverRaf.current = requestAnimationFrame(step);
          }, dragStart2),
        );

        const endX2 = single ? firstEnd.x : lastEnd.x;
        const endY2 = single ? firstEnd.y : lastEnd.y;
        const taglineText =
          introEls.map((e) => e.textContent ?? "").join(" ").trim() ||
          introEls[0]?.textContent ||
          "";

        // 9b. Carry the tagline to centre.
        push(
          window.setTimeout(() => {
            setCursor({
              x: endX2 - 2,
              y: endY2,
              visible: true,
              grabbing: false,
            });
          }, dragStart2 + dragDur2 + 160),
        );
        push(
          window.setTimeout(() => {
            setCursorInstant(true);
            setCursor({
              x: endX2 - 2,
              y: endY2,
              visible: true,
              grabbing: true,
            });
          }, dragStart2 + dragDur2 + 450),
        );

        const carryStart2 = dragStart2 + dragDur2 + 320;
        const carryDur2 = 1200;
        const dropX2 = window.innerWidth / 2;
        const dropY2 = window.innerHeight / 2;
        push(
          window.setTimeout(() => {
            setGhostFading(false);
            const t0 = performance.now();
            const step = (now: number) => {
              const p = Math.min(1, (now - t0) / carryDur2);
              const x = endX2 - 2 + (dropX2 - (endX2 - 2)) * p;
              const y = endY2 + (dropY2 - endY2) * p;
              setCursor({ x, y, visible: true, grabbing: true });
              if (taglineText)
                setGhost({ text: taglineText, x: x + 10, y: y + 10 });
              if (p < 1) takeoverRaf.current = requestAnimationFrame(step);
            };
            takeoverRaf.current = requestAnimationFrame(step);
          }, carryStart2),
        );

        push(
          window.setTimeout(() => {
            setCursor({
              x: dropX2,
              y: dropY2,
              visible: true,
              grabbing: false,
            });
            setGhostFading(true);
            window.getSelection()?.removeAllRanges();
            setCenterText({ x: dropX2, y: dropY2, text: taglineText });
            push(window.setTimeout(() => setGhost(null), 350));
            takeoverActive.current = false;
            finalCycle.current = true;
            push(window.setTimeout(() => setPhase("closing"), 500));
          }, carryStart2 + carryDur2),
        );
      }, restAt),
    );
  };

  // ─── After docking: dive straight into the takeover ────────────────────────
  useEffect(() => {
    if (phase !== "docked") return;
    const t = setTimeout(() => {
      setNativeCursorHidden(true);
      runTakeover();
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      realMouse.current = { x: e.clientX, y: e.clientY };
    };
    realMouse.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const getContainerSize = useCallback((): { w: number; h: number } => {
    const el = containerRef.current;
    if (!el) return { w: window.innerWidth, h: window.innerHeight };
    return { w: el.clientWidth, h: el.clientHeight };
  }, []);

  const getWinRect = useCallback(
    (): { x: number; y: number; w: number; h: number } => {
      const el = windowRef.current;
      const cont = containerRef.current;
      if (!el || !cont) return { x: 0, y: 0, w: width, h: 320 };
      const b = el.getBoundingClientRect();
      const c = cont.getBoundingClientRect();
      return { x: b.left - c.left, y: b.top - c.top, w: b.width, h: b.height };
    },
    [width],
  );

  const getDockTarget = useCallback(
    (docking: boolean): Pt => {
      const { w, h } = getContainerSize();
      if (docking) {
        return { x: DOCK_LEFT + DOCK_W / 2, y: DOCK_TOP + DOCK_H / 2 };
      }
      return { x: w / 2, y: h - 64 };
    },
    [getContainerSize],
  );

  const setupCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { w, h } = getContainerSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [getContainerSize]);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { w, h } = getContainerSize();
    const ctx = c.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, w, h);
  }, [getContainerSize]);

  const startAnim = useCallback(
    (dir: Dir, dockPt: Pt, onDone: () => void, winOverride?: Pt) => {
      cancelAnimationFrame(rafRef.current);
      const off = offRef.current;
      if (!off) {
        onDone();
        return;
      }
      const rect = getWinRect();
      const wr = winOverride
        ? { ...rect, x: winOverride.x, y: winOverride.y }
        : rect;
      const win = { x: wr.x, y: wr.y };
      const WIN_W = wr.w;
      const WIN_H = wr.h;
      const { w: cw, h: ch } = getContainerSize();
      let start: number | null = null;
      const frame = (ts: number) => {
        if (!start) start = ts;
        const rawT = clamp((ts - start) / DUR, 0, 1);
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        renderGenie(ctx, off, cw, ch, rawT, dir, dockPt, win, WIN_W, WIN_H);
        if (rawT < 1) rafRef.current = requestAnimationFrame(frame);
        else onDone();
      };
      rafRef.current = requestAnimationFrame(frame);
    },
    [getWinRect, getContainerSize],
  );

  // ─── Triggers ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && phase === "idle" && !finalCycle.current) setPhase("opening");
    if (dock && phase === "open") setPhase("docking");
    if (!open && phase === "open") setPhase("closing");
  }, [open, dock, phase]);

  // ─── Opening: genie in from bottom dock ──────────────────────────────────────
  useEffect(() => {
    if (phase !== "opening") return;
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled) return;
      try {
        const off = await toCanvas(windowRef.current!, {
          pixelRatio: 1,
          style: { opacity: "1" },
        });
        if (cancelled) return;
        offRef.current = off;
      } catch (e) {
        console.warn("GenieWindow: toCanvas snapshot failed (opening)", e);
      }
      setupCanvas();
      startAnim("open", getDockTarget(false), () => {
        flushSync(() => setPhase("open"));
        clearCanvas();
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [phase, setupCanvas, startAnim, clearCanvas, getDockTarget]);

  // ─── Docking: cursor grabs console → drags to corner ─────────────────────────
  useEffect(() => {
    if (phase !== "docking") return;

    const wr = getWinRect();
    const windowLeft = wr.x;
    const windowTop = wr.y;
    const dockedX = DOCK_LEFT;
    const dockedY = DOCK_TOP;

    setNativeCursorHidden(true);

    const m = realMouse.current;
    setCursor({ x: m.x, y: m.y, visible: true, grabbing: false });

    const t1 = setTimeout(() => {
      setCursor({
        x: windowLeft + GRAB_X,
        y: windowTop + GRAB_Y,
        visible: true,
        grabbing: false,
      });
    }, 520);

    const t2 = setTimeout(() => {
      setCursor({
        x: dockedX + GRAB_X,
        y: dockedY + GRAB_Y,
        visible: true,
        grabbing: true,
      });
      setConsoleOffset({ x: dockedX - windowLeft, y: dockedY - windowTop });
    }, 850);

    const t4 = setTimeout(() => {
      setPhase("docked");
    }, 1700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t4);
    };
  }, [phase, getContainerSize, getWinRect]);

  // ─── Closing: genie out to bottom dock ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "closing") return;
    setNativeCursorHidden(false);
    setCursor((c) => ({ ...c, visible: false }));
    clearTakeover();
    setGhost(null);
    setGhostFading(false);
    takeoverActive.current = false;
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled) return;
      try {
        const off = await toCanvas(windowRef.current!, {
          pixelRatio: 1,
          style: { opacity: "1" },
        });
        if (cancelled) return;
        offRef.current = off;
      } catch (e) {
        console.warn("GenieWindow: toCanvas snapshot failed (docking)", e);
      }
      const cvs = canvasRef.current;
      if (cvs) cvs.style.zIndex = "50";
      if (windowRef.current) {
        windowRef.current.style.opacity = "0";
        windowRef.current.style.pointerEvents = "none";
      }
      setupCanvas();
      const center = getWinRect();
      const corner = {
        x: center.x + consoleOffset.x,
        y: center.y + consoleOffset.y,
      };
      startAnim(
        "minimize",
        getDockTarget(false),
        () => {
          clearCanvas();
          setPhase("idle");
          onCloseComplete?.();
        },
        corner,
      );
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, setupCanvas, startAnim, clearCanvas, getDockTarget, onCloseComplete]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      clearTakeover();
      setPlaceholder(null);
      setGhost(null);
      setGhostFading(false);
      setCenterText(null);
    },
    [],
  );

  useEffect(() => {
    const prevent = (e: DragEvent) => {
      if (takeoverActive.current) e.preventDefault();
    };
    window.addEventListener("dragstart", prevent);
    return () => window.removeEventListener("dragstart", prevent);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────────
  const isDocking = phase === "docking";
  const isDocked = phase === "docked";
  const isDockingOrDocked = isDocking || isDocked;

  const centeredStyle: CSSProperties = {
    width,
    opacity: phase === "open" || isDocking || isDocked ? 1 : 0,
    transition: "none",
    backgroundColor: "#0a0a0a",
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9000] pointer-events-none"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%", zIndex: 30 }}
      />

      {phase !== "idle" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            ref={windowRef}
            animate={{
              x: isDockingOrDocked ? consoleOffset.x : 0,
              y: isDockingOrDocked ? consoleOffset.y : 0,
            }}
            transition={{
              duration: phase === "closing" ? 0 : 0.65,
              ease: [0.32, 0.72, 0.2, 1],
            }}
            style={centeredStyle}
            className="pointer-events-auto docked-win"
          >
            {children}
          </motion.div>
        </div>
      )}

      {cursor.visible && (
        <div
          style={{
            position: "fixed",
            left: cursor.x,
            top: cursor.y,
            zIndex: 10000,
            pointerEvents: "none",
            transition: cursorInstant
              ? "opacity 0.3s ease-out"
              : "left 0.6s cubic-bezier(0.32,0.72,0.2,1), top 0.6s cubic-bezier(0.32,0.72,0.2,1), opacity 0.3s ease-out",
            opacity: cursor.visible ? 1 : 0,
          }}
        >
          <CursorIcon grabbing={cursor.grabbing} />
          {ghost && (
            <div
              style={{
                position: "absolute",
                left: 14,
                top: 14,
                zIndex: 9500,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: ghost.size ?? 12,
                lineHeight: 1.4,
                whiteSpace: "nowrap",
                textShadow: ghost.bg ? "none" : "0 1px 2px rgba(0,0,0,0.15)",
                color: ghost.color ?? "rgba(245, 245, 245, 0.7)",
                background: ghost.bg ?? "transparent",
                padding: ghost.bg ? "3px 9px" : 0,
                borderRadius: ghost.bg ? 8 : 0,
                border: ghost.bg ? "1px solid rgba(0,0,0,0.1)" : "none",
                boxShadow: ghost.bg ? "0 2px 10px rgba(0,0,0,0.18)" : "none",
                opacity: ghostFading ? 0 : 1,
                transition: "opacity 0.35s ease-out",
                pointerEvents: "none",
              }}
            >
              {ghost.text}
            </div>
          )}
        </div>
      )}

      {placeholder && (
        <nav
          style={{
            position: "fixed",
            left: placeholder.x,
            top: placeholder.y,
            transform: "translate(-50%, -50%)",
            zIndex: 8000,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "8px 12px",
            borderRadius: 14,
            background: "transparent",
            animation: "placeholderIn 0.4s ease-out both",
            pointerEvents: "auto",
          }}
        >
          {placeholder.items.map((item, i) => {
            const isLast = i === placeholder.items.length - 1;
            return (
              <a
                key={i}
                href={"#" + slugify(item)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  color: isLast ? "#0a0a0a" : "#171717",
                  fontSize: 14,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(0, 0, 0, 0.09)";
                  e.currentTarget.style.color = "#0a0a0a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = isLast
                    ? "#0a0a0a"
                    : "#171717";
                }}
              >
                {item}
              </a>
            );
          })}
        </nav>
      )}

      {centerText && (
        <div
          style={{
            position: "fixed",
            left: centerText.x,
            top: centerText.y,
            transform: "translate(-50%, -50%)",
            zIndex: 8000,
            color: "#0a0a0a",
            fontSize: "clamp(20px, 4vw, 34px)",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            whiteSpace: "nowrap",
            textAlign: "center",
            animation: "placeholderIn 0.4s ease-out both",
            pointerEvents: "none",
          }}
        >
          {centerText.text}
        </div>
      )}
    </div>
  );
}

type Phase = "idle" | "opening" | "open" | "docking" | "closing" | "docked";
