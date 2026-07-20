import type { CSSProperties } from "react";

/** Small "no entry" icon marking a band this member rated 1 (actively wants to avoid). */
export function AvoidIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M5.7 5.7l12.6 12.6" />
    </svg>
  );
}
