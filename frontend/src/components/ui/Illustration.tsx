export type IllustrationKind = "search" | "chart" | "list";

/** Small inline SVG illustrations for empty states. They use theme colours, so they follow light/dark mode. */
export function Illustration({ kind = "search", className = "h-28 w-28" }: { kind?: IllustrationKind; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden>
      <circle cx="60" cy="62" r="46" fill="var(--color-primary-50)" />
      {kind === "search" && (
        <>
          <rect x="30" y="26" width="46" height="60" rx="7" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="2" />
          <rect x="38" y="38" width="30" height="4" rx="2" fill="var(--color-primary-100)" />
          <rect x="38" y="48" width="24" height="4" rx="2" fill="var(--color-border)" />
          <rect x="38" y="58" width="28" height="4" rx="2" fill="var(--color-border)" />
          <rect x="38" y="68" width="18" height="4" rx="2" fill="var(--color-border)" />
          <circle cx="78" cy="78" r="15" fill="var(--color-surface)" stroke="var(--color-primary-600)" strokeWidth="4" />
          <path d="M89 89 L102 102" stroke="var(--color-primary-600)" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {kind === "chart" && (
        <>
          <rect x="26" y="30" width="68" height="58" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="2" />
          <rect x="36" y="62" width="10" height="18" rx="3" fill="#059669" />
          <rect x="52" y="48" width="10" height="32" rx="3" fill="var(--color-primary-600)" />
          <rect x="68" y="56" width="10" height="24" rx="3" fill="#e11d48" />
          <path d="M34 44 L50 38 L66 42 L84 34" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" />
        </>
      )}
      {kind === "list" && (
        <>
          <rect x="28" y="28" width="64" height="64" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="2" />
          {[42, 58, 74].map((y, i) => (
            <g key={y}>
              <circle cx="40" cy={y} r="4" fill={["#059669", "#e11d48", "var(--color-primary-600)"][i]} />
              <rect x="50" y={y - 3} width={[32, 26, 30][i]} height="6" rx="3" fill="var(--color-border)" />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
