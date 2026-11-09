/**
 * Daybreak: an arch over a half sun on the horizon. Drawn on a 120 × 64 grid
 * (outer radius 60, inner 41, sun 32, sun base lifted 3 above the arch's feet).
 */
export function Mark({ size = 40, className, rising = false }: { size?: number; className?: string; rising?: boolean }) {
  return (
    <svg
      width={size}
      height={(size * 64) / 120}
      viewBox="0 0 120 64"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      style={{ height: "auto", maxWidth: "100%" }}
    >
      <path d="M0 64a60 60 0 0 1 120 0h-19a41 41 0 0 0-82 0Z" />
      <clipPath id="daybreak-horizon">
        <rect x="0" y="0" width="120" height="61" />
      </clipPath>
      <g clipPath="url(#daybreak-horizon)">
        <path className={rising ? "sun-rise" : undefined} d="M28 61a32 32 0 0 1 64 0Z" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`wordmark ${className}`}>mora</span>;
}

export function Lockup({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`lockup ${className}`}>
      <Mark size={size} />
      <Wordmark />
    </span>
  );
}
