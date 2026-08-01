"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { motion } from "motion/react";
import { toCanvas } from "html-to-image";
import type { CSSProperties, ReactNode } from "react";

// ─── Math (identical to UI Layouts' mac-genie implementation) ──────────────────
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const eioC = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eIn2 = (t: number) => t * t;
const eOut2 = (t: number) => 1 - (1 - t) * (1 - t);

type Phase = "idle" | "opening" | "open" | "docking" | "closing" | "docked";
type Dir = "open" | "minimize";
interface Pt {
  x: number;
  y: number;
}

// The heart of the macOS genie effect: warp the window one scanline-row at a
// time from the dock point to the window position (open) or back (minimize).
function renderGenie(
  ctx: CanvasRenderingContext2D,
  off: HTMLCanvasElement,
  W: number,
  H: number,
  rawT: number,
  dir: Dir,
  dock: Pt,
  win: Pt,
  WIN_W: number,
  WIN_H: number,
): void {
  ctx.clearRect(0, 0, W, H);
  for (let y = 0; y < WIN_H; y++) {
    const r = y / WIN_H;
    const rowXStart = dir === "minimize" ? (1 - r) * 0.65 : r * 0.65;
    const xP = clamp((rawT - rowXStart) / (1 - rowXStart), 0, 1);
    const xE = eioC(xP);
    const rowYStart = dir === "minimize" ? (1 - r) * 0.2 : r * 0.2;
    const yP = clamp((rawT - rowYStart) / (1 - rowYStart), 0, 1);
    const yE = eIn2(yP);
    let left: number, right: number, destY: number;
    if (dir === "minimize") {
      left = lerp(win.x, dock.x, xE);
      right = lerp(win.x + WIN_W, dock.x, xE);
      destY = lerp(win.y + y, dock.y, yE);
    } else {
      left = lerp(dock.x, win.x, xE);
      right = lerp(dock.x, win.x + WIN_W, xE);
      destY = lerp(dock.y, win.y + y, yE);
    }
    const rowW = right - left;
    if (rowW < 0.8) continue;
    ctx.drawImage(off, 0, y, WIN_W, 1, left, destY, rowW, 1);
  }
  const glowRaw = dir === "minimize" ? rawT : 1 - rawT;
  if (glowRaw > 0.75) {
    const a = eOut2((glowRaw - 0.75) / 0.25) * 0.3;
    const hex = Math.round(a * 255)
      .toString(16)
      .padStart(2, "0");
    const g = ctx.createRadialGradient(dock.x, dock.y, 0, dock.x, dock.y, 55);
    g.addColorStop(0, "#ffffff" + hex);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

// ─── macOS-style cursor ────────────────────────────────────────────────────────
function CursorIcon({ grabbing }: { grabbing: boolean }) {
  return (
    <svg
      width="22"
      height="26"
      viewBox="0 0 22 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))",
        transform: grabbing ? "scale(0.92)" : "scale(1)",
        transformOrigin: "2px 2px",
        transition: "transform 0.15s ease-out",
      }}
    >
      <path
        d="M1 1L1 21L6.5 16L11.5 24L15 22L10 14L17 13.5L1 1Z"
        fill="black"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DUR = 460;
const FULL_W = 520;
const DOCK_W = FULL_W;
const DOCK_H = 370;
const DOCK_LEFT = 16;
const CONTENT_TOP = 76;
const DOCK_TOP = CONTENT_TOP + 16;
const GRAB_X = 24;
const GRAB_Y = 28;

// Turn a nav token like "о_нас.md" into a URL-safe anchor slug ("о_нас").
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
  // When true the fake cursor follows its target instantly (used while
  // drag-selecting), instead of gliding via the 0.8s CSS transition.
  const [cursorInstant, setCursorInstant] = useState(false);
  // The carried nav line, dropped by the cursor as a real navigation panel.
  const [placeholder, setPlaceholder] = useState<{
    x: number;
    y: number;
    items: string[];
  } | null>(null);
  // Semi-transparent copy of the carried text that trails the cursor while it
  // is dragged down (mimics the OS drag ghost so you can see what's moving).
  const [ghost, setGhost] = useState<{
    text: string;
    x: number;
    y: number;
    color?: string;
    size?: number;
    bg?: string;
  } | null>(null);
  const [ghostFading, setGhostFading] = useState(false);
  // The tagline once it has been carried to the centre of the screen and
  // dropped there (a centred hero line, mirroring the nav placeholder).
  const [centerText, setCenterText] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  // The user's real pointer position, tracked even while it's invisible.
  const realMouse = useRef({ x: 0, y: 0 });

  // Hide/show the native cursor by toggling a class on <html> and <body>.
  const setNativeCursorHidden = (hidden: boolean) => {
    document.body.classList.toggle("hide-cursor", hidden);
    document.documentElement.classList.toggle("hide-cursor", hidden);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  // Timers/raf driving the periodic "takeover" that selects the nav line.
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

  // Select the first `p` fraction of `node`'s text (progressive drag-select).
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

  // All text nodes (in document order) inside an element.
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

  // Take the mouse back: hide the native cursor, walk the fake one to the nav
  // line, drag-select it, then hand control back to the visitor.
  const runTakeover = () => {
    const root = windowRef.current;
    const navEl = root?.querySelector<HTMLElement>("[data-nav-line]");
    if (!navEl || !root) {
      // Console gone (closed) — just give control back, no animation.
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
    const textNode = (navEl.firstChild as Text | null);
    const len = textNode?.textContent?.length ?? 0;
    const navText = navEl.textContent ?? "";

    const push = (t: number) => {
      takeoverTimers.current.push(t);
      return t;
    };

    // 1. From the corner the cursor calmly glides to the start of the nav line —
    //    a smooth, continuous motion (no teleport, no abrupt cut).
    setCursorInstant(false);
    setCursor({ x: startX, y: startY, visible: true, grabbing: false });

    // 2. Press down at the start.
    push(
      window.setTimeout(() => {
        setCursor({ x: startX, y: startY, visible: true, grabbing: true });
      }, 1000),
    );

    // 3. Drag across, selecting the text as it goes.
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

    // 5. Release at the end of the line, then "pick up" the selection to carry.
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

    // 6. Glide the selection down toward the bottom-center of the screen,
    //    trailing a semi-transparent copy of the text behind the cursor.
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

      // 7. Drop: the cursor releases the text — the ghost fades out gracefully
      //    and, only now, the placeholder rectangle appears.
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

    // 8. Don't hand control back. Fly the cursor back to the console and
    //    highlight the whole intro block (whoami + cat приветствие.txt) with
    //    the same progressive drag-select used in step 6. The animation rests
    //    here with that text selected — control stays with the cursor, the
    //    visitor's real pointer is never returned.
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
        // True end of a line's *text* (not the line box, which is much wider).
        const lineTextEnd = (el: HTMLElement): { x: number; y: number } => {
          const r = document.createRange();
          r.selectNodeContents(el);
          const rs = r.getClientRects();
          const rect = rs[rs.length - 1];
          return rect
            ? { x: rect.right, y: rect.top + rect.height / 2 }
            : { x: el.getBoundingClientRect().right, y: el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 };
        };
        const firstEnd = lineTextEnd(introEls[0]);
        const lastEnd = lineTextEnd(introEls[introEls.length - 1]);
        // The right edge we sweep down: the widest intro line, so every line
        // below the first gets selected in full as the cursor passes it.
        const lineRight = Math.max(...rects.map((r) => r.right));
        const allNodes = introEls.flatMap((el) => collectTextNodes(el));
        const anchorNode = allNodes[0];
        if (!anchorNode) return;

        const sx = firstR.left + 2;
        const sy = firstR.top + firstR.height / 2;

        // Glide back to the start of the intro block.
        setCursorInstant(false);
        setCursor({ x: sx, y: sy, visible: true, grabbing: false });

        // Press down at the start (same cadence as step 6).
        const pressAt = 900;
        push(
          window.setTimeout(() => {
            setCursor({ x: sx, y: sy, visible: true, grabbing: true });
          }, pressAt),
        );

        // Natural drag-select:
        //  • single line  → sweep horizontally across it to the end,
        //  • multiple lines → A) sweep the first line, then B) go straight down
        //    the right edge so each later line fills in whole (how a person
        //    drags a selection down a paragraph).
        const dragStart = pressAt;
        const single = introEls.length <= 1;
        const dragDur = single ? 1400 : 2500;
        const phaseA = 0.32; // share of time spent finishing the first line
        const caretAt = (x: number, y: number): { node: Node; offset: number } | null => {
          const d = document as Document & {
            caretRangeFromPoint?: (x: number, y: number) => Range | null;
            caretPositionFromPoint?: (x: number, y: number) => {
              offsetNode: Node;
              offset: number;
            } | null;
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
              const p = Math.min(1, (now - t0) / dragDur);
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
              // Map the cursor to the nearest text position and extend the
              // selection from the block's start to there — the browser does
              // the line-wrapping math, so it looks like a real drag.
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
          }, dragStart),
        );

        // Rest exactly at the real end of the text (not the line box edge).
        const endX = single ? firstEnd.x : lastEnd.x;
        const endY = single ? firstEnd.y : lastEnd.y;
        const taglineText =
          introEls.map((e) => e.textContent ?? "").join(" ").trim() ||
          introEls[0]?.textContent ||
          "";

        // 9b. Carry the highlighted text to the centre — same code as the nav
        //     line carry (steps 5–7) above: release, pick up, glide, drop.
        //     cursorInstant stays true, so the rAF drives the cursor smoothly.
        push(
          window.setTimeout(() => {
            setCursor({ x: endX - 2, y: endY, visible: true, grabbing: false });
          }, dragStart + dragDur + 160),
        );
        push(
          window.setTimeout(() => {
            setCursorInstant(true);
            setCursor({ x: endX - 2, y: endY, visible: true, grabbing: true });
          }, dragStart + dragDur + 450),
        );

        const carryStart = dragStart + dragDur + 320;
        const carryDur = 1200;
        const dropX = window.innerWidth / 2;
        const dropY = window.innerHeight / 2;
        push(
          window.setTimeout(() => {
            // The nav-line drop (step 7) left ghostFading=true and never
            // reset it, so this ghost would inherit opacity:0. Clear it
            // here so the tagline ghost is actually visible.
            setGhostFading(false);
            const t0 = performance.now();
            const step = (now: number) => {
              const p = Math.min(1, (now - t0) / carryDur);
              const x = endX - 2 + (dropX - (endX - 2)) * p;
              const y = endY + (dropY - endY) * p;
              setCursor({ x, y, visible: true, grabbing: true });
              if (taglineText)
                setGhost({ text: taglineText, x: x + 10, y: y + 10 });
              if (p < 1) takeoverRaf.current = requestAnimationFrame(step);
            };
            takeoverRaf.current = requestAnimationFrame(step);
          }, carryStart),
        );

        push(
          window.setTimeout(() => {
            setCursor({ x: dropX, y: dropY, visible: true, grabbing: false });
            setGhostFading(true);
            window.getSelection()?.removeAllRanges();
            setCenterText({ x: dropX, y: dropY, text: taglineText });
            push(window.setTimeout(() => setGhost(null), 350));
            takeoverActive.current = false;
            // The tagline now lives at centre as the hero — the console's job
            // is done, so genie it out off screen.
            finalCycle.current = true;
            push(
              window.setTimeout(() => setPhase("closing"), 500),
            );
          }, carryStart + carryDur),
        );
      }, restAt),
    );
  };

  // ─── After docking: dive straight into the takeover ────────────────────────
  //    We deliberately do NOT hand the cursor back to the visitor here — doing
  //    so created a dead pause between docking and the nav-line select. The
  //    takeover itself makes the fake cursor "appear" at the visitor's real
  //    pointer, so it still reads as their own hand taking over.
  useEffect(() => {
    if (phase !== "docked") return;
    // Tiny settle so the docked window is visible before the cursor grabs the
    // nav line — no control is given back to the visitor.
    const t = setTimeout(() => {
      setNativeCursorHidden(true);
      runTakeover();
    }, 200);
    return () => clearTimeout(t);
  }, [phase]);

  // Track the real pointer at all times (cheap); used by the takeover so the
  // fake cursor can walk back to wherever the user's mouse actually is.
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
    c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [getContainerSize]);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { w, h } = getContainerSize();
    c.getContext("2d")!.clearRect(0, 0, w, h);
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
      const wr = winOverride ? { ...rect, x: winOverride.x, y: winOverride.y } : rect;
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
        renderGenie(
          c.getContext("2d")!,
          off,
          cw,
          ch,
          rawT,
          dir,
          dockPt,
          win,
          WIN_W,
          WIN_H,
        );
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

    // Hide the native cursor for the whole drag + hand-off.
    setNativeCursorHidden(true);

    // 1. Cursor "appears" exactly where the user's real pointer is, so it
    //    reads as their own cursor from the very first frame.
    const m = realMouse.current;
    setCursor({ x: m.x, y: m.y, visible: true, grabbing: false });

    // 2. Slides to the title bar of the console
    const t1 = setTimeout(() => {
      setCursor({
        x: windowLeft + GRAB_X,
        y: windowTop + GRAB_Y,
        visible: true,
        grabbing: false,
      });
    }, 520);

    // 3. Grabs the title bar — cursor "presses" + console starts moving
    const t2 = setTimeout(() => {
      setCursor({
        x: dockedX + GRAB_X,
        y: dockedY + GRAB_Y,
        visible: true,
        grabbing: true,
      });
      setConsoleOffset({ x: dockedX - windowLeft, y: dockedY - windowTop });
    }, 850);

    // 4. Settle into docked — keep the offset so the window stays put.
    //    From here the takeover takes over immediately (no hand-off pause).
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
    // NB: keep centerText — the carried tagline stays on screen as the hero.
    takeoverActive.current = false;
    let cancelled = false;
    const run = async () => {
      // The window jumps (invisibly — opacity 0) to its centred, transform-free
      // position so html-to-image can snapshot it cleanly, then the genie warps
      // it FROM the corner DOWN to the bottom dock — mirroring the entrance.
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
      // The window was visually parked in the corner, so warp the genie FROM
      // the corner DOWN to the bottom of the screen.
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
  }, [phase, setupCanvas, startAnim, clearCanvas, getDockTarget, onCloseComplete]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    clearTakeover();
    setPlaceholder(null);
    setGhost(null);
    setGhostFading(false);
    setCenterText(null);
  }, []);

  // Suppress the browser's native drag ghost (semi-transparent text copy)
  // while the fake cursor is programmatically carrying the selection.
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

  // ─── Hand-off: after docking, the takeover runs immediately (see above) ─────

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

      {/* Single persistent window — kept mounted across open → docking → docked
          so the inner terminal never remounts (and never re-types). The docking
          offset is held through the `docked` phase, so nothing re-animates. */}
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

      {/* Cursor */}
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
          {/* Semi-transparent copy of the carried text, trailing the
              cursor. Rendered as a child so it always mounts with it. */}
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

      {/* The carried nav line, dropped as the site's navigation panel */}
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

      {/* The tagline, carried to and dropped at the centre of the screen */}
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
