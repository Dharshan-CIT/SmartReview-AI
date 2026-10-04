import { Download, FileUp, ListChecks, Printer, Sparkles } from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HighlightedReview } from "../components/HighlightedReview";
import { SentimentChart } from "../components/SentimentChart";
import { SentimentBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, PageHeader } from "../components/ui/Card";
import { EmptyState, ErrorState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";
import { CountUp } from "../hooks/useMotion";
import { api } from "../services/api";
import type { BatchResponse } from "../types";
import { GRID, TICK, TOOLTIP_STYLE } from "../utils/chart";
import { downloadText, extractReviews, resultsToCsv } from "../utils/csv";
import { insightsFromAspects } from "../utils/insights";
import { buildReportHtml, openReport } from "../utils/report";
import { capitalize, truncate } from "../utils/format";
import { BATCH_SAMPLES } from "../utils/samples";
import { pct, sentimentStyle } from "../utils/sentiment";

const MAX = 50;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="hover-lift p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{typeof value === "number" ? <CountUp value={value} /> : value}</p>
    </Card>
  );
}

export default function BatchPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BatchResponse | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const reviews = useMemo(() => extractReviews(text, filename), [text, filename]);
  const tooMany = reviews.length > MAX;

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast("error", "That file is too large (max 2 MB).");
      return;
    }
    setFilename(file.name);
    setText(await file.text());
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setData(await api.analyzeBatch(reviews));
      setOpen(null);
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const s = data?.summary;
  const counts = s ? { positive: s.positive, negative: s.negative, neutral: s.neutral } : { positive: 0, negative: 0, neutral: 0 };
  const best = s && [...s.top_aspects].sort((a, b) => b.positive - a.positive)[0];
  const worst = s && [...s.top_aspects].sort((a, b) => b.negative - a.negative)[0];
  const insights = s ? insightsFromAspects(s.top_aspects) : [];

  return (
    <div>
      <PageHeader
        title="Batch Analysis"
        subtitle={`Analyze up to ${MAX} reviews at once (paste one per line, or upload a .txt / .csv file) and get a feature-level report.`}
      />

      <Card className="shadow-pop">
        <div className="p-5 sm:p-6">
          <label htmlFor="batch" className="mb-2 block text-sm font-medium">Reviews (one per line)</label>
          <textarea
            id="batch"
            value={text}
            onChange={(e) => { setText(e.target.value); setFilename(""); }}
            rows={7}
            placeholder={"Paste reviews here, one per line...\nThe screen is great but the battery is poor.\nThe keyboard feels cheap."}
            className="w-full resize-y rounded-xl border border-border bg-bg p-4 text-base leading-relaxed placeholder:text-muted/70 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100/60"
          />
          <p className={`mt-2 text-xs ${tooMany ? "font-medium text-neg" : "text-muted"}`} aria-live="polite">
            {reviews.length} review{reviews.length === 1 ? "" : "s"} detected{filename && ` from ${filename}`}
            {tooMany ? `: too many, the limit is ${MAX}.` : ` (limit ${MAX}). For CSV files the "review" or "text" column is used.`}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="sr-only"
                aria-label="Upload a .txt or .csv file"
                onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
              />
              <Button variant="secondary" icon={<FileUp className="h-4 w-4" aria-hidden />} onClick={() => fileRef.current?.click()}>Upload file</Button>
              <Button variant="secondary" icon={<ListChecks className="h-4 w-4" aria-hidden />} onClick={() => { setText(BATCH_SAMPLES.join("\n")); setFilename(""); }}>
                Load sample reviews
              </Button>
            </div>
            <Button size="lg" loading={loading} disabled={!reviews.length || tooMany} onClick={run} icon={<Sparkles className="h-4 w-4" aria-hidden />}>
              {loading ? "Analyzing…" : `Analyze ${reviews.length || ""} review${reviews.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-8" aria-live="polite">
        {error && <ErrorState message={error} onRetry={run} />}
        {!error && !data && !loading && <Card><EmptyState message="Add some reviews to see a feature-level report." /></Card>}

        {data && s && (
          <div className="space-y-6">
            <div className="stagger grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Reviews" value={s.reviews} />
              <Stat label="Aspects found" value={s.aspects} />
              <Stat label="Positive" value={s.positive} />
              <Stat label="Negative" value={s.negative} />
              <Stat label="Neutral" value={s.neutral} />
              <Stat label="Avg confidence" value={pct(s.avg_confidence)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { tone: "positive" as const, label: "Most praised feature", row: best, n: best?.positive },
                { tone: "negative" as const, label: "Most criticised feature", row: worst, n: worst?.negative },
              ].map((c) => (
                <Card key={c.label} className={`p-5 ${sentimentStyle(c.tone).card}`}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{c.label}</p>
                  <p className="mt-1 text-2xl font-semibold capitalize">{c.row && (c.n ?? 0) > 0 ? c.row.aspect : "Nothing yet"}</p>
                  {c.row && (c.n ?? 0) > 0 && (
                    <p className="text-sm text-muted">{c.n} mention{c.n === 1 ? "" : "s"} across {s.reviews} reviews</p>
                  )}
                </Card>
              ))}
            </div>

            <Card className="gradient-border p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Key takeaways</p>
              <ul className="mt-2 space-y-1.5">
                {insights.map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="text-primary-ink">•</span><span>{t}</span></li>)}
              </ul>
            </Card>

            {data.results.some((r) => r.warnings?.length) && (
              <p role="note" className="rounded-lg border border-mix-border bg-mix-bg px-4 py-3 text-sm text-mix">
                ⚠ {data.results.filter((r) => r.warnings?.length).length} review(s) look like they are about product types the models were not tested on. Treat those results with care.
              </p>
            )}

            {s.low_confidence > 0 && (
              <p className="rounded-lg border border-mix-border bg-mix-bg px-4 py-3 text-sm text-mix">
                ⚠ {s.low_confidence} aspect{s.low_confidence === 1 ? "" : "s"} had low confidence (under 60%). Treat those with care.
              </p>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
              <Card>
                <CardHeader title="Sentiment distribution" />
                <div className="p-5"><SentimentChart counts={counts} /></div>
              </Card>
              <Card>
                <CardHeader title="Most discussed aspects" subtitle="Positive, negative and neutral mentions" />
                <div className="p-4" style={{ height: Math.max(320, s.top_aspects.length * 34 + 60) }}>
                  {s.top_aspects.length === 0 ? (
                    <EmptyState message="No aspects detected." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={s.top_aspects.map((a) => ({ ...a, aspect: capitalize(a.aspect) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid horizontal={false} stroke={GRID} />
                        <XAxis type="number" allowDecimals={false} tick={TICK} />
                        <YAxis type="category" dataKey="aspect" width={130} tick={TICK} interval={0} />
                        <Tooltip {...TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ color: "var(--color-muted)" }} />
                        <Bar dataKey="positive" name="Positive" stackId="a" fill={sentimentStyle("positive").hex} />
                        <Bar dataKey="negative" name="Negative" stackId="a" fill={sentimentStyle("negative").hex} />
                        <Bar dataKey="neutral" name="Neutral" stackId="a" fill={sentimentStyle("neutral").hex} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>

            <Card>
              <CardHeader
                title="Results"
                subtitle="Click a row to see its highlighted aspects."
                action={
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Printer className="h-4 w-4" aria-hidden />}
                      onClick={() => openReport(buildReportHtml(data, insights))}
                    >
                      Report (PDF)
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Download className="h-4 w-4" aria-hidden />}
                      onClick={() => { downloadText("smartreview_batch.csv", resultsToCsv(data.results)); toast("success", "CSV downloaded."); }}
                    >
                      Export CSV
                    </Button>
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-bg text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">#</th>
                      <th scope="col" className="px-4 py-3 font-medium">Review</th>
                      <th scope="col" className="px-4 py-3 font-medium">Overall</th>
                      <th scope="col" className="px-4 py-3 text-center font-medium">Aspects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((r, i) => (
                      <Fragment key={i}>
                        <tr className="cursor-pointer border-t border-border hover:bg-primary-50/40" onClick={() => setOpen(open === i ? null : i)}>
                          <td className="px-4 py-3 text-muted">{i + 1}</td>
                          <td className="max-w-md px-4 py-3">
                            <button className="text-left" aria-expanded={open === i} onClick={(e) => { e.stopPropagation(); setOpen(open === i ? null : i); }}>
                              {truncate(r.review, 90)}
                            </button>
                          </td>
                          <td className="px-4 py-3"><SentimentBadge sentiment={r.overall_sentiment} /></td>
                          <td className="px-4 py-3 text-center font-medium">{r.aspects.length}</td>
                        </tr>
                        {open === i && (
                          <tr className="border-t border-border bg-bg/60">
                            <td colSpan={4} className="px-4 py-4"><HighlightedReview text={r.review} aspects={r.aspects} /></td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
