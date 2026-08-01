# Bansheebbyy — студия уютных интерфейсов

macOS-стилизованный портфолио-сайт с эффектом «джинни», печатающим терминалом и рукописным прелоадером.

## Технологии

- **React 19** + **TypeScript 6**
- **Vite 8** — сборка и dev-сервер
- **Tailwind CSS 4** — стили
- **Motion** (Framer Motion) — анимации окон
- **Vivus** — SVG-анимация рукописного текста
- **html-to-image** — DOM-to-canvas для эффекта джинни

## Структура

```
src/
├── components/
│   ├── ErrorBoundary.tsx      # Обработчик ошибок React
│   ├── GenieWindow.tsx        # macOS genie-эффект (Canvas 2D)
│   ├── MacWindow.tsx          # Шапка окна macOS
│   ├── Preloader.tsx          # Рукописный SVG-прелоадер
│   └── ui/
│       ├── CursorIcon.tsx     # SVG-курсор
│       ├── SyntaxHighlightedText.tsx
│       └── terminal.tsx       # Печатающий терминал
├── hooks/
│   ├── useAudio.ts            # Звуки клавиатуры (Web Audio API)
│   └── useInView.ts           # IntersectionObserver hook
├── lib/
│   ├── genie-math.ts          # Математика анимаций (lerp, easing)
│   ├── genie-renderer.ts      # Canvas-рендер genie-эффекта
│   ├── tokenizer.ts           # Bash-токенизатор
│   └── utils.ts               # cn() utility
├── App.tsx
├── main.tsx
├── index.css
└── site.css
```

## Запуск

```bash
npm install
npm run dev
```

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер с HMR |
| `npm run build` | Production-сборка (tsc + vite build) |
| `npm run preview` | Предпросмотр сборки |
| `npm run lint` | Oxlint |

## Лицензия

MIT
