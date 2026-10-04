import { useEffect, useState } from "react";

/**
 * Semi-circle gauge of the NET sentiment of a review: (positive - negative) / aspects, from -1 to +1.
 * Purely a visual summary of the model's aspect results; the exact counts are shown as text next to it.
 */
export function SentimentGauge({ positive, negative, neutral }: { positive: number; negative: number; neutral: number }) {
  const total = positive + negative + neutral;
  const score = total ? (positive - negative) / total : 0;
  const [shown, setShown] = useState(0); // start centred, then swing to the real value
  useEffect(() => {
    const t = setTimeout(() => setShown(score), 120);
    return () => clearTimeout(t);
  }, [score]);

  const angle = shown * 90; // -90deg (far left) .. +90deg (far right)
  const label = !total ? "No aspects" : score > 0.34 ? "Mostly positive" : score < -0.34 ? "Mostly negative" : "Balanced";
  const text = `Net sentiment ${score >= 0 ? "+" : ""}${score.toFixed(2)} (${label}): ${positive} positive, ${negative} negative, ${neutral} neutral`;

  return (
    <figure className="w-full max-w-[220px]" role="img" aria-label={text}>
      <svg viewBox="0 0 200 118" className="w-full" aria-hidden>
        <defs>
          <linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#e11d48" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--color-border)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gauge-grad)" strokeWidth="14" strokeLinecap="round" opacity={total ? 1 : 0.25} />
        {[-1, -0.5, 0, 0.5, 1].map((t) => {
          const a = (t * 90 - 90) * (Math.PI / 180);
          return <line key={t} x1={100 + 66 * Math.cos(a)} y1={100 + 66 * Math.sin(a)} x2={100 + 72 * Math.cos(a)} y2={100 + 72 * Math.sin(a)} stroke="var(--color-muted)" strokeWidth="1.5" />;
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 100px", transition: "transform 0.9s cubic-bezier(.2,.9,.3,1.1)" }}>
          <line x1="100" y1="100" x2="100" y2="34" stroke="var(--color-text)" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="7" fill="var(--color-text)" />
        <text x="16" y="116" fontSize="10" fill="var(--color-muted)">−</text>
        <text x="178" y="116" fontSize="10" fill="var(--color-muted)">+</text>
      </svg>
      <figcaption className="-mt-1 text-center">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted tabular-nums">net score {score >= 0 ? "+" : ""}{score.toFixed(2)}</span>
      </figcaption>
    </figure>
  );
}
