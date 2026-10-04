import { Fragment } from "react";
import type { Aspect } from "../types";
import { LOW_CONFIDENCE, pct, sentimentStyle } from "../utils/sentiment";

/** Renders the review with each detected aspect highlighted by sentiment, with a hover/focus tooltip. */
export function HighlightedReview({ text, aspects }: { text: string; aspects: Aspect[] }) {
  const sorted = [...aspects].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  sorted.forEach((a, i) => {
    if (a.start < cursor || a.end > text.length) return; // skip overlaps / bad offsets defensively
    if (a.start > cursor) parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, a.start)}</Fragment>);
    const s = sentimentStyle(a.sentiment);
    parts.push(
      <span key={`a${i}`} className="group relative inline-block">
        <mark
          tabIndex={0}
          aria-label={`${a.text}: ${s.label}, ${pct(a.confidence)} confidence`}
          className={`cursor-help rounded-md border-b-2 px-1 py-0.5 font-medium ${s.mark}`}
        >
          <span aria-hidden className="mr-1 text-xs">{s.icon}</span>
          {text.slice(a.start, a.end)}
        </mark>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-pop group-focus-within:block group-hover:block"
        >
          <span className="block"><span className="text-slate-400">Aspect:</span> {a.text}</span>
          <span className="block"><span className="text-slate-400">Sentiment:</span> {s.label}</span>
          <span className="block"><span className="text-slate-400">Confidence:</span> {pct(a.confidence)}{a.confidence < LOW_CONFIDENCE && " (low)"}</span>
        </span>
      </span>,
    );
    cursor = a.end;
  });
  if (cursor < text.length) parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);

  return <p className="text-lg leading-loose text-text">{parts}</p>;
}
