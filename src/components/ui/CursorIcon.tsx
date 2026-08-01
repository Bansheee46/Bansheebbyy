export function CursorIcon({ grabbing }: { grabbing: boolean }) {
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
