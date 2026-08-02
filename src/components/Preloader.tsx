import { useEffect, useRef, useState } from "react";
import Vivus from "vivus";
import handwriteSvg from "@/assets/handwrite.svg?raw";

interface Props {
  onDone: () => void;
}

export default function Preloader({ onDone }: Props) {
  const [writing, setWriting] = useState(true);
  const [done, setDone] = useState(false);
  const replayRef = useRef<HTMLButtonElement>(null);
  const vivusRef = useRef<Vivus | null>(null);
  const apiRef = useRef<{ replay: () => void } | null>(null);

  useEffect(() => {
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
        start: "autostart",
      },
      finish,
    );

    apiRef.current = {
      replay: () => {
        setDone(false);
        setWriting(false);
        replayRef.current?.classList.remove("show");
        vivusRef.current?.reset();
        vivusRef.current?.play(1, finish);
      },
    };

    return () => {
      vivusRef.current?.destroy();
    };
  }, [onDone]);

  return (
    <>
      <div
        id="preloader"
        className={`${writing ? "writing" : ""} ${done ? "done" : ""}`}
      >
        {/*
          Safe: handwriteSvg is a static asset imported via Vite ?raw at build time.
          Never accept user-provided content here.
        */}
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
    </>
  );
}
