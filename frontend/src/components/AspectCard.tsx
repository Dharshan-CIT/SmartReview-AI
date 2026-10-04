import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useVotedAspects } from "../hooks/useVotedAspects";
import { api } from "../services/api";
import type { Aspect } from "../types";
import { capitalize } from "../utils/format";
import { LOW_CONFIDENCE, SENTIMENTS, pct, sentimentStyle } from "../utils/sentiment";
import { SentimentBadge } from "./ui/Badge";
import { useToast } from "./ui/Toast";

export function AspectCard({ aspect }: { aspect: Aspect }) {
  const s = sentimentStyle(aspect.sentiment);
  const [showWhy, setShowWhy] = useState(false);
  const probs = aspect.probabilities;
  const toast = useToast();
  const { voted, record } = useVotedAspects();
  const [counts, setCounts] = useState({ up: aspect.thumbs_up ?? 0, down: aspect.thumbs_down ?? 0 });
  const myVote = aspect.id != null ? voted[aspect.id] : undefined;

  async function vote(direction: "up" | "down") {
    if (aspect.id == null || myVote) return;
    record(aspect.id, direction);
    setCounts((c) => (direction === "up" ? { ...c, up: c.up + 1 } : { ...c, down: c.down + 1 }));
    try {
      await api.giveFeedback(aspect.id, direction);
      toast("success", "Thanks for the feedback — it helps spot where the model struggles.");
    } catch {
      toast("error", "Couldn't save your feedback. Please try again.");
    }
  }

  return (
    <li className={`hover-lift rounded-xl border bg-surface p-4 shadow-card ${s.card}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-base font-semibold leading-snug">{capitalize(aspect.text)}</h4>
        <SentimentBadge sentiment={aspect.sentiment} />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Model confidence</span>
          <span className="font-semibold text-text">{pct(aspect.confidence)}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(aspect.confidence * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Confidence for ${aspect.text}`}
          className="h-1.5 overflow-hidden rounded-full bg-neu-bg"
        >
          <div className="bar-in h-full rounded-full" style={{ width: pct(aspect.confidence), background: s.hex }} />
        </div>
        {aspect.confidence < LOW_CONFIDENCE && (
          <p className="mt-2 text-xs font-medium text-mix">⚠ Low confidence: the model is unsure about this one.</p>
        )}
        {aspect.hint && (
          <p className="mt-2 text-xs text-muted">ℹ Note: {aspect.hint}. This could also be read as neutral.</p>
        )}
        {aspect.adjusted && (
          <p className="mt-2 text-xs text-muted">Adjusted by a wording rule: {aspect.adjusted}. The model alone leaned {aspect.sentiment === "neutral" ? "positive or negative" : aspect.sentiment}.</p>
        )}
        {probs && (
          <div className="mt-3">
            <button type="button" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}
              className="text-xs font-medium text-primary-ink underline-offset-2 hover:underline">
              {showWhy ? "Hide" : "Show"} probability breakdown
            </button>
            {showWhy && (
              <ul className="mt-2 space-y-1.5" aria-label={`Probabilities for ${aspect.text}`}>
                {SENTIMENTS.map((k) => (
                  <li key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-muted">{sentimentStyle(k).icon} {sentimentStyle(k).label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neu-bg">
                      <span className="block h-full rounded-full" style={{ width: pct(probs[k] ?? 0), background: sentimentStyle(k).hex }} />
                    </span>
                    <span className="w-9 shrink-0 text-right tabular-nums">{pct(probs[k] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {aspect.id != null && (
          <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
            <span className="text-xs text-muted">Was this right?</span>
            <button type="button" disabled={!!myVote} onClick={() => vote("up")}
              aria-pressed={myVote === "up"} aria-label={`Mark the ${aspect.text} result as correct`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${myVote === "up" ? "border-pos bg-pos-bg text-pos" : "border-border text-muted hover:border-pos-border hover:text-pos"} ${myVote && myVote !== "up" ? "opacity-50" : ""}`}>
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> {counts.up}
            </button>
            <button type="button" disabled={!!myVote} onClick={() => vote("down")}
              aria-pressed={myVote === "down"} aria-label={`Mark the ${aspect.text} result as wrong`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${myVote === "down" ? "border-neg bg-neg-bg text-neg" : "border-border text-muted hover:border-neg-border hover:text-neg"} ${myVote && myVote !== "down" ? "opacity-50" : ""}`}>
              <ThumbsDown className="h-3.5 w-3.5" aria-hidden /> {counts.down}
            </button>
            {myVote && <span className="text-xs text-muted">Vote recorded</span>}
          </div>
        )}
      </div>
    </li>
  );
}
