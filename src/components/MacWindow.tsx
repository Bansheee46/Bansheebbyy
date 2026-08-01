import { useEffect, useState } from "react";

export default function MacWindow() {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => {
      setClock(
        new Date().toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit"
        })
      );
    };
    update();
    const t = window.setInterval(update, 1000 * 10);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="window">
      <div className="titlebar">
        <span className="light red" />
        <span className="light yellow" />
        <span className="light green" />
        <div className="title">Bansheebbyy</div>
      </div>
      <div className="menubar">
        <div className="left">
          <span className="logo">Bansheebbyy</span>
          <span className="item">File</span>
          <span className="item">Edit</span>
          <span className="item">View</span>
          <span className="item">Help</span>
        </div>
        <div className="right">
          <span className="clock">{clock}</span>
        </div>
      </div>
      <div className="desktop" />
    </div>
  );
}
