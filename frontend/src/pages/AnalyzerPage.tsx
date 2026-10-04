import { Check, Copy, Play, RotateCcw, Sparkles, Square } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { AspectCard } from "../components/AspectCard";
import { HighlightedReview } from "../components/HighlightedReview";
import { SentimentGauge } from "../components/SentimentGauge";
import { SentimentBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, PageHeader } from "../components/ui/Card";
import { EmptyState, ErrorState } from "../components/ui/States";
import { useAnalyze } from "../hooks/useAnalyze";
import type { AnalysisResult } from "../types";
import { MAX_REVIEW_CHARS, SAMPLES } from "../utils/samples";
import { SENTIMENTS, pct, sentimentStyle } from "../utils/sentiment";

const SentimentChart = lazy(() => import("../components/SentimentChart").then((m) => ({ default: m.SentimentChart })));

const HEADLINE: Record<string, string> = {
  positive: "Customers are happy with the features mentioned.",
  negative: "Customers are unhappy with the features mentioned.",
  neutral: "Feedback on the features mentioned is neutral.",
  mixed: "Some features are praised while others are criticised.",
  none: "No specific product features were detected.",
};

function RatioBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  return (
    <div role="img" aria-label={SENTIMENTS.map((s) => `${counts[s]} ${s}`).join(", ")} className="flex h-2.5 w-full overflow-hidden rounded-full bg-neu-bg">
      {SENTIMENTS.map((s) => counts[s] > 0 && (
        <div key={s} className="animate-grow h-full" style={{ width: `${(counts[s] / total) * 100}%`, background: sentimentStyle(s).hex }} />
      ))}
    </div>
  );
}

export default function AnalyzerPage() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const { result, error, loading, stage, analyze, reset } = useAnalyze();
  const [demo, setDemo] = useState(false);
  const stopDemoRef = useRef(false);
  useEffect(() => () => { stopDemoRef.current = true; }, []); // stop the demo when leaving the page

  /** Guided demo: analyze every example in turn, pausing so the audience can read each result. */
  async function playDemo() {
    stopDemoRef.current = false;
    setDemo(true);
    for (const s of SAMPLES) {
      if (stopDemoRef.current) break;
      setText(s.text);
      await analyze(s.text);
      await new Promise((r) => setTimeout(r, 3500));
    }
    setDemo(false);
  }
  function stopDemo() {
    stopDemoRef.current = true;
    setDemo(false);
  }
  const trimmed = text.trim();
  const tooLong = text.length > MAX_REVIEW_CHARS;
  const disabled = !trimmed || tooLong;

  const submit = () => {
    if (!disabled && !loading) analyze(trimmed);
  };

  const counts = {
    positive: result?.aspects.filter((a) => a.sentiment === "positive").length ?? 0,
    negative: result?.aspects.filter((a) => a.sentiment === "negative").length ?? 0,
    neutral: result?.aspects.filter((a) => a.sentiment === "neutral").length ?? 0,
  };
  const total = counts.positive + counts.negative + counts.neutral;

  async function copy(r: AnalysisResult) {
    try {
      const payload = {
        review: r.review,
        overall_sentiment: r.overall_sentiment,
        aspects: r.aspects.map(({ text, sentiment, confidence }) => ({ text, sentiment, confidence })),
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: ignore */
    }
  }

  return (
    <div>
      <PageHeader title="Review Analyzer" subtitle="Paste a product review. SmartReview AI finds each feature mentioned and tells you how the customer feels about it." />

      <Card className="shadow-pop">
        <form className="p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label htmlFor="review" className="mb-2 block text-sm font-medium">Product review</label>
          <textarea
            id="review"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
            rows={5}
            placeholder="Paste your product review here..."
            aria-describedby="review-help"
            className="w-full resize-y rounded-xl border border-border bg-bg p-4 text-base leading-relaxed placeholder:text-muted/70 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100/60"
          />
          <div id="review-help" className="mt-2 flex justify-between gap-3 text-xs">
            <span className={tooLong ? "font-medium text-neg" : "text-muted"}>
              {tooLong ? `Too long: please stay under ${MAX_REVIEW_CHARS} characters.` : "Works best on laptops, phones, cameras and similar electronics; other products may be less accurate. Tip: Ctrl+Enter to analyze."}
            </span>
            <span className={`shrink-0 tabular-nums ${tooLong ? "font-medium text-neg" : "text-muted"}`} aria-live="polite">{text.length}/{MAX_REVIEW_CHARS}</span>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Try an example</p>
              <div className="flex flex-wrap gap-2">
                {SAMPLES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setText(s.text)}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-all hover:-translate-y-0.5 hover:border-primary-100 hover:bg-primary-50 hover:text-primary-ink"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {demo ? (
                <Button type="button" variant="secondary" size="lg" icon={<Square className="h-4 w-4" aria-hidden />} onClick={stopDemo}>Stop demo</Button>
              ) : (
                <Button type="button" variant="secondary" size="lg" disabled={loading} icon={<Play className="h-4 w-4" aria-hidden />} onClick={playDemo}>Play demo</Button>
              )}
              {(text || result) && !demo && (
                <Button type="button" variant="ghost" size="lg" icon={<RotateCcw className="h-4 w-4" aria-hidden />} onClick={() => { setText(""); reset(); }}>Clear</Button>
              )}
              <Button type="submit" size="lg" disabled={disabled} loading={loading} icon={<Sparkles className="h-4 w-4" aria-hidden />}>
                {loading ? "Analyzing…" : "Analyze review"}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <div className="mt-8" aria-live="polite">
        {loading && (
          <Card className="animate-fade-up p-10 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" aria-hidden />
            <p role="status" className="font-medium">{stage}</p>
            <div className="mx-auto mt-5 max-w-sm space-y-2" aria-hidden>
              <div className="skeleton h-3 rounded" />
              <div className="skeleton mx-auto h-3 w-3/4 rounded" />
            </div>
          </Card>
        )}

        {!loading && error && <ErrorState message={error} onRetry={() => analyze(trimmed)} />}

        {!loading && !error && !result && (
          <Card><EmptyState message="Enter a product review to begin analysis." /></Card>
        )}

        {!loading && !error && result && (
          <div className="space-y-6">
            <Card className={`animate-fade-up overflow-hidden ${sentimentStyle(result.overall_sentiment).card}`}>
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Overall sentiment</p>
                  <p className="mt-1 text-4xl font-bold tracking-tight" style={{ color: sentimentStyle(result.overall_sentiment).hex }}>
                    {sentimentStyle(result.overall_sentiment).label.toUpperCase()}
                  </p>
                  <p className="mt-1 text-muted">{HEADLINE[result.overall_sentiment]}</p>
                </div>
                <div className="flex flex-col items-center gap-3 sm:items-end">
                  {total > 0 && <SentimentGauge positive={counts.positive} negative={counts.negative} neutral={counts.neutral} />}
                  <SentimentBadge sentiment={result.overall_sentiment} className="text-sm" />
                  <Button variant="secondary" size="sm" onClick={() => copy(result)} icon={copied ? <Check className="h-4 w-4 text-pos" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}>
                    {copied ? "Copied" : "Copy result (JSON)"}
                  </Button>
                </div>
              </div>
              {total > 0 && (
                <div className="border-t border-border bg-bg/60 px-5 py-3 sm:px-6">
                  <RatioBar counts={counts} total={total} />
                  <p className="mt-2 text-xs text-muted">
                    {total} aspect{total === 1 ? "" : "s"} · {counts.positive} positive · {counts.negative} negative · {counts.neutral} neutral · avg confidence{" "}
                    {pct(result.aspects.reduce((a, b) => a + b.confidence, 0) / total)}
                  </p>
                </div>
              )}
              {result.aspects.length === 0 && (
                <p className="border-t border-border px-5 py-4 text-muted sm:px-6">
                  No specific product features were detected in this review. Try mentioning product parts such as the screen, keyboard or battery.
                </p>
              )}
            </Card>

            {result.warnings && result.warnings.length > 0 && (
              <div role="note" className="rounded-xl border border-mix-border bg-mix-bg px-4 py-3 text-sm text-mix">
                ⚠ {result.warnings.join(" ")}
              </div>
            )}

            <Card className="animate-fade-up [animation-delay:80ms]">
              <CardHeader title="Review with highlighted aspects" subtitle="Hover or focus a highlighted term to see the model's confidence." />
              <div className="p-5 sm:p-6"><HighlightedReview text={result.review} aspects={result.aspects} /></div>
            </Card>

            {result.aspects.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <section aria-labelledby="aspects-h">
                  <h2 id="aspects-h" className="mb-3 text-lg font-semibold">Detected aspects</h2>
                  <ul className="stagger grid gap-3 sm:grid-cols-2">
                    {result.aspects.map((a) => <AspectCard key={`${a.start}-${a.end}`} aspect={a} />)}
                  </ul>
                </section>
                <Card className="animate-fade-up [animation-delay:160ms]">
                  <CardHeader title="Sentiment breakdown" />
                  <div className="p-5"><Suspense fallback={<div className="skeleton h-[180px] rounded-lg" aria-hidden />}><SentimentChart counts={counts} /></Suspense></div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
