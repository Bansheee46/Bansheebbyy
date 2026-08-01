import { useState } from "react";
import MacWindow from "@/components/MacWindow";
import Preloader from "@/components/Preloader";
import GenieWindow from "@/components/GenieWindow";
import { Terminal } from "@/components/ui/terminal";

type Stage = "preloader" | "site" | "terminal";

const COMMANDS = [
  "whoami",
  "cat приветствие.txt",
  "ls ~/студия",
  "open контакты"
];

const OUTPUTS: Record<number, string[]> = {
  0: ["Bansheebbyy — студия уютных интерфейсов 🌿"],
  1: [
    "Привет! Мы делаем сайты, в которые приятно заглядывать.",
    "Спокойные цвета, плавные движения и забота о деталях."
  ],
  2: ["дизайн/   разработка/   портфолио/   контакты/   о_нас.md"],
  3: ["Открываю адресную книгу…", "Пишите нам: hello@bbyy.dev 💛"]
};

export default function App() {
  const [stage, setStage] = useState<Stage>("preloader");
  const [docking, setDocking] = useState(false);

  const handlePreloaderDone = () => {
    setStage("site");
    // The terminal element opens shortly after the site is shown.
    window.setTimeout(() => setStage("terminal"), 700);
  };

  // Once the console has finished printing, give the visitor a brief moment to
  // read the last line, then dock the window into the top-right corner.
  const handleTerminalComplete = () => {
    window.setTimeout(() => setDocking(true), 850);
  };

  return (
    <>
      <MacWindow />

      {stage === "preloader" && <Preloader onDone={handlePreloaderDone} />}

      {stage === "terminal" && (
        <GenieWindow open dock={docking}>
          <Terminal
            commands={COMMANDS}
            outputs={OUTPUTS}
            username="bansheebbyy"
            enableSound
            navLineText="дизайн/"
            introLines={[1, 1]}
            onComplete={handleTerminalComplete}
          />
        </GenieWindow>
      )}
    </>
  );
}
