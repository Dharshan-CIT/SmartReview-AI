import { Download } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SentimentChart } from "../components/SentimentChart";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, PageHeader } from "../components/ui/Card";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { CountUp } from "../hooks/useMotion";
import { api } from "../services/api";
import { GRID, TICK, TOOLTIP_STYLE } from "../utils/chart";
import { capitalize } from "../utils/format";
import { insightsFromAspects } from "../utils/insights";
import { sentimentStyle } from "../utils/sentiment";

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "positive" | "negative" | "neutral" }) {
  const s = tone && sentimentStyle(tone);
  return (
    <Card className="hover-lift p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 flex items-baseline gap-2 text-3xl font-semibold tracking-tight">
        {s && <span aria-hidden className="text-lg" style={{ color: s.hex }}>{s.icon}</span>}
        <CountUp value={value} />
      </p>
    </Card>
  );
}

function Insight({ label, aspect, count, tone }: { label: string; aspect?: string; count?: number; tone: "positive" | "negative" }) {
  const st = sentimentStyle(tone);
  return (
    <Card className={`p-5 ${st.card}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      {aspect ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-semibold capitalize">{aspect}</span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${st.badge}`}><span aria-hidden>{st.icon}</span>{count} mention{count === 1 ? "" : "s"}</span>
        </p>
      ) : (
        <p className="mt-1 text-muted">Nothing yet</p>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsync(api.analytics);
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="What customers talk about most, and how they feel about it, across every review you've analyzed."
        action={data && data.reviews_analyzed > 0 ? (
          <a href={api.historyExportUrl({})} download className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-5 text-sm font-medium hover:bg-primary-50">
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </a>
        ) : undefined}
      />

      {loading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && data && data.reviews_analyzed === 0 && (
        <Card>
          <EmptyState title="No data yet" message="Analyze a few reviews and your insights will appear here."
            action={<Link to="/analyze"><Button>Analyze a review</Button></Link>} />
        </Card>
      )}

      {!loading && data && data.reviews_analyzed > 0 && (
        <div className="animate-fade-up space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Reviews analyzed" value={data.reviews_analyzed} />
            <Kpi label="Total aspects" value={data.total_aspects} />
            <Kpi label="Positive aspects" value={data.positive_aspects} tone="positive" />
            <Kpi label="Negative aspects" value={data.negative_aspects} tone="negative" />
            <Kpi label="Neutral aspects" value={data.neutral_aspects} tone="neutral" />
            {data.avg_confidence !== undefined && <Kpi label="Avg confidence (%)" value={Math.round(data.avg_confidence * 100)} />}
            {data.low_confidence_aspects !== undefined && <Kpi label="Low-confidence aspects" value={data.low_confidence_aspects} />}
          </div>

          <Card className="gradient-border p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Key takeaways</p>
            <ul className="mt-2 space-y-1.5">
              {insightsFromAspects(data.top_aspects).map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="text-primary-ink">•</span><span>{t}</span></li>)}
            </ul>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {(() => {
              const best = [...data.top_aspects].sort((a, b) => b.positive - a.positive)[0];
              const worst = [...data.top_aspects].sort((a, b) => b.negative - a.negative)[0];
              return (
                <>
                  <Insight tone="positive" label="Most praised feature" aspect={best && best.positive > 0 ? best.aspect : undefined} count={best?.positive} />
                  <Insight tone="negative" label="Most criticised feature" aspect={worst && worst.negative > 0 ? worst.aspect : undefined} count={worst?.negative} />
                </>
              );
            })()}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
            <Card>
              <CardHeader title="Sentiment distribution" subtitle="All detected aspects" />
              <div className="p-5"><SentimentChart counts={{ positive: data.positive_aspects, negative: data.negative_aspects, neutral: data.neutral_aspects }} /></div>
            </Card>

            <Card>
              <CardHeader title="Most discussed aspects" subtitle="Click a bar to see the reviews that mention it" />
              <div className="p-4" style={{ height: Math.max(320, data.top_aspects.length * 34 + 60) }}>
                {data.top_aspects.length === 0 ? <EmptyState message="No aspects detected yet." /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.top_aspects.map((a) => ({ ...a, aspect: capitalize(a.aspect) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} stroke={GRID} />
                      <XAxis type="number" allowDecimals={false} tick={TICK} />
                      <YAxis type="category" dataKey="aspect" width={120} tick={TICK} interval={0} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ color: "var(--color-muted)" }} />
                      <Bar dataKey="positive" name="Positive" stackId="a" cursor="pointer" fill={sentimentStyle("positive").hex} onClick={(d) => navigate(`/history?aspect=${encodeURIComponent(String((d as { aspect?: string }).aspect ?? "").toLowerCase())}`)} />
                      <Bar dataKey="negative" name="Negative" stackId="a" cursor="pointer" fill={sentimentStyle("negative").hex} onClick={(d) => navigate(`/history?aspect=${encodeURIComponent(String((d as { aspect?: string }).aspect ?? "").toLowerCase())}`)} />
                      <Bar dataKey="neutral" name="Neutral" stackId="a" cursor="pointer" fill={sentimentStyle("neutral").hex} radius={[0, 4, 4, 0]} onClick={(d) => navigate(`/history?aspect=${encodeURIComponent(String((d as { aspect?: string }).aspect ?? "").toLowerCase())}`)} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Review analysis trend" subtitle="Reviews analyzed per day" />
            <div className="h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="date" tick={TICK} />
                  <YAxis allowDecimals={false} tick={TICK} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="reviews" name="Reviews" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
