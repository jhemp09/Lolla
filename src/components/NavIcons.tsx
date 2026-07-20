/**
 * Bottom-nav icons as a matched set — same stroke weight, corner rounding, and
 * viewBox — so they read as one family instead of mismatched emoji glyphs that
 * render differently (and inconsistently in weight/style) across platforms.
 */
const commonProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function BandsIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}

export function ScheduleIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

export function SyncIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
      <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5" />
      <path d="M4 20v-4.5h4.5" />
    </svg>
  );
}

export function AdminIcon() {
  return (
    <svg {...commonProps} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.8 6.2l-1.55 1.55M7.75 16.25 6.2 17.8M17.8 17.8l-1.55-1.55M7.75 7.75 6.2 6.2" />
    </svg>
  );
}
