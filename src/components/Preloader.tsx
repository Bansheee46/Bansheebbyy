import { useEffect, useRef, useState } from "react";
import handwriteSvg from "@/assets/handwrite.svg?raw";

interface Props {
  onDone: () => void;
}

export default function Preloader({ onDone }: Props) {
  const [writing, setWriting] = useState(true);
  const [done, setDone] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paths = stageRef.current?.querySelectorAll<SVGPathElement>("path.letter");
    if (!paths?.length) return;

    const DURATION = 280;
    const PAUSE = 120;
    let raf: number;
    let start = 0;
    let activeIdx = 0;
    let finished = false;

    const lengths = Array.from(paths, (p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      return len;
    });

    const tick = (t: number) => {
      if (finished) return;
      if (!start) start = t;

      while (activeIdx < paths.length) {
        const elapsed = t - start;
        const needed = activeIdx * (DURATION + PAUSE);
        if (elapsed < needed) break;

        const letterElapsed = elapsed - needed;
        const progress = Math.min(letterElapsed / DURATION, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        paths[activeIdx].style.strokeDashoffset = `${lengths[activeIdx] * (1 - ease)}`;

        if (progress >= 1) {
          activeIdx++;
        } else {
          break;
        }
      }

      if (activeIdx >= paths.length) {
        finished = true;
        setTimeout(() => {
          setWriting(false);
          setDone(true);
          onDone();
        }, 450);
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      finished = true;
      cancelAnimationFrame(raf);
    };
  }, [onDone]);

  const replay = () => {
    setDone(false);
    setWriting(false);
    const paths = stageRef.current?.querySelectorAll<SVGPathElement>("path.letter");
    if (!paths?.length) return;
    paths.forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });
    setTimeout(() => {
      setWriting(true);
    }, 50);
  };

  return (
    <>
      <div
        id="preloader"
        className={`${writing ? "writing" : ""} ${done ? "done" : ""}`}
      >
        <div id="stage" ref={stageRef} dangerouslySetInnerHTML={{ __html: handwriteSvg }} />
        <div className="caption">
          Loading<span className="dots" />
        </div>
      </div>
      <button
        id="replay"
        className={done ? "show" : ""}
        title="Replay the handwriting"
        onClick={replay}
      >
        Replay
      </button>
    </>
  );
}
