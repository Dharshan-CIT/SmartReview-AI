import type { Overall } from "../../types";
import { sentimentStyle } from "../../utils/sentiment";

/** Sentiment pill: colour + icon + text, so meaning never depends on colour alone. */
export function SentimentBadge({ sentiment, className = "" }: { sentiment: Overall; className?: string }) {
  const s = sentimentStyle(sentiment);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.badge} ${className}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}
