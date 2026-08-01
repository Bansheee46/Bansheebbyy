import { useEffect, useRef, useState } from "react";
import Vivus from "vivus";
import handwriteSvg from "@/assets/handwrite.svg?raw";

interface Props {
  onDone: () => void;
}

export default function Preloader({ onDone }: Props) {
  const [writing, setWriting] = useState(true);
  const [done, setDone] = useState(false);
  const penRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const vivusRef = useRef<Vivus | null>(null);
  const apiRef = useRef<{ replay: () => void } | null>(null);

  useEffect(() => {
    let raf = 0;
    let running = false;

    const positionPen = () => {
      // SVG geometry typings vary across lib versions; the runtime API is stable.
      const svg = document.getElementById("handwrite") as unknown as SVGSVGElement | null;
      const pen = penRef.current;
      if (!svg || !pen) return;
      const paths = svg.querySelectorAll("path");
      let tip: any = null;
      let tipPath: any = null;
      let active = false;
      paths.forEach((el) => {
        const p = el as unknown as SVGPathElement;
        const total = p.getTotalLength();
        if (!total) return;
        const off = parseFloat(p.style.strokeDashoffset);
        const drawn = total - (isNaN(off) ? 0 : off);
        if (drawn > 1 && drawn < total - 1) {
          tip = p.getPointAtLength(drawn);
          tipPath = p;
          active = true;
        } else if (drawn >= total - 1 && !tip) {
          tip = p.getPointAtLength(total);
          tipPath = p;
        }
      });
      if (tip && tipPath) {
        const ctm = tipPath.getScreenCTM();
        if (ctm) {
          const pt = svg.createSVGPoint();
          pt.x = tip.x;
          pt.y = tip.y;
          const s = pt.matrixTransform(ctm);
          pen.style.left = `${s.x}px`;
          pen.style.top = `${s.y}px`;
        }
        pen.style.opacity = active ? "1" : "0";
      } else {
        pen.style.opacity = "0";
      }
    };

    const frame = () => {
      positionPen();
      if (vivusRef.current && vivusRef.current.getStatus() === "end") {
        if (penRef.current) penRef.current.style.opacity = "0";
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const startLoop = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };

    const finish = () => {
      setTimeout(() => {
        setWriting(false);
        setDone(true);
        replayRef.current?.classList.add("show");
        onDone();
      }, 450);
    };

    vivusRef.current = new Vivus(
      "handwrite",
      {
        type: "oneByOne",
        duration: 190,
        animTimingFunction: Vivus.EASE,
        pathTimingFunction: Vivus.EASE_OUT,
        dashGap: 3,
        start: "autostart"
      },
      finish
    );
    startLoop();

    apiRef.current = {
      replay: () => {
        setDone(false);
        setWriting(false);
        replayRef.current?.classList.remove("show");
        if (penRef.current) penRef.current.style.opacity = "1";
        vivusRef.current?.reset();
        vivusRef.current?.play(1, finish);
        startLoop();
      }
    };

    return () => {
      cancelAnimationFrame(raf);
      vivusRef.current?.destroy();
    };
  }, [onDone]);

  return (
    <>
      <div id="preloader" className={`${writing ? "writing" : ""} ${done ? "done" : ""}`}>
        <div id="stage" dangerouslySetInnerHTML={{ __html: handwriteSvg }} />
        <div className="caption">
          Loading<span className="dots" />
        </div>
      </div>
      <button
        id="replay"
        ref={replayRef}
        title="Replay the handwriting"
        onClick={() => apiRef.current?.replay()}
      >
        Replay
      </button>
      <div id="pen" ref={penRef} />
    </>
  );
}
