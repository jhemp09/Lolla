/** Simplified Spotify mark — a circle with three curved "sound wave" bars, in their brand green. */
export function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1DB954" />
      <path
        d="M6.5 10c3.5-1 8-.6 10.7 1"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6.9 13c2.9-.8 6.6-.5 8.9.8"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M7.3 16c2.3-.6 5.2-.4 7 .6"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
