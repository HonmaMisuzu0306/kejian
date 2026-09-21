export function BrandSymbol({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-label="课间标志"
    >
      <path d="M6 7h30l6 6v28H6z" fill="currentColor" />
      <path d="M10 11h22l6 6v20H10z" fill="var(--surface-paper)" />
      <path
        d="M15 16h9v9h-9zm12 0h6v4h-6zm0 7h7v2h-7zM15 29h19v3H15z"
        fill="currentColor"
      />
      <path
        d="M36 7v8h8"
        fill="none"
        stroke="var(--signal-primary)"
        strokeWidth="3"
      />
    </svg>
  )
}
