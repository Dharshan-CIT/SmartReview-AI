import { GitCompareArrows, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, PageHeader } from "../components/ui/Card";
import { EmptyState, ErrorState } from "../components/ui/States";
import { api } from "../services/api";
import type { AspectSummary, BatchResponse } from "../types";
import { compareAspects, netScore } from "../utils/aspects";
import { GRID, TICK, TOOLTIP_STYLE } from "../utils/chart";
import { capitalize } from "../utils/format";
import { COMPARE_SAMPLES, MAX_REVIEW_CHARS } from "../utils/samples";
import { extractReviews } from "../utils/csv";
import { sentimentStyle } from "../utils/sentiment";

const MAX = 50;
const COLOR_A = "#4f46e5";
const COLOR_B = "#0d9488";

function Counts({ x }: { x?: AspectSummary }) {
  if (!x) return <span className="text-muted">not mentioned</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-pos">✓ {x.positive}</span>
      <span className="text-neg">✕ {x.negative}</span>
      <span className="text-neu">– {x.neutral}</span>
      <span className="text-xs text-muted">net {netScore(x) >= 0 ? "+" : ""}{netScore(x).toFixed(2)}</span>
    </span>
  );
}

function Column({ id, name, setName, text, setText }: { id: string; name: string; setName: (v: string) => void; text: string; setText: (v: string) => void }) {
  const n = extractReviews(text).length;
  return (
    <Card className="p-5">
      <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium">Product name</label>
      <input id={`${id}-name`} value={name} maxLength={40} onChange={(e) => setName(e.target.value)}
        className="mb-3 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100/60" />
      <label htmlFor={`${id}-reviews`} className="mb-1 block text-sm font-medium">Reviews (one per line)</label>
      <textarea id={`${id}-reviews`} value={text} onChange={(e) => setText(e.target.value)} rows={7}
        placeholder="Paste reviews for this product, one per line..."
        className="w-full resize-y rounded-xl border border-border bg-bg p-3 leading-relaxed placeholder:text-muted/70 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100/60" />
      <p className={`mt-1 text-xs ${n > MAX ? "font-medium text-neg" : "text-muted"}`}>{n} review{n === 1 ? "" : "s"} (limit {MAX})</p>
    </Card>
  );
}

export default function ComparePage() {
  const [nameA, setNameA] = useState("Product A");
  const [nameB, setNameB] = useState("Product B");
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ a: BatchResponse; b: BatchResponse; nameA: string; nameB: string } | null>(null);

  const revA = useMemo(() => extractReviews(textA), [textA]);
  const revB = useMemo(() => extractReviews(textB), [textB]);
  const invalid = !revA.length || !revB.length || revA.length > MAX || revB.length > MAX || [...revA, ...revB].some((r) => r.length > MAX_REVIEW_CHARS);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([api.analyzeBatch(revA, false), api.analyzeBatch(revB, false)]);
      setRes({ a, b, nameA: nameA.trim() || "Product A", nameB: nameB.trim() || "Product B" });
    } catch (e) {
      setRes(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const rows = res ? compareAspects(res.a.summary.top_aspects, res.b.summary.top_aspects) : [];
  const both = rows.filter((r) => r.a && r.b);
  const winsA = both.filter((r) => r.winner === "A").length;
  const winsB = both.filter((r) => r.winner === "B").length;
  const ties = both.filter((r) => r.winner === "tie").length;
  const chart = both.slice(0, 8).map((r) => ({ aspect: capitalize(r.aspect), a: +netScore(r.a).toFixed(2), b: +netScore(r.b).toFixed(2) }));

  const verdict = !res ? "" : winsA === winsB
    ? "It's a draw across the shared features."
    : `${winsA > winsB ? res.nameA : res.nameB} comes out ahead on more of the shared features.`;

  return (
    <div>
      <PageHeader title="Compare Products" subtitle="Paste reviews for two products. SmartReview AI finds the features customers mention and shows which product wins on each." />

      <div className="grid gap-5 md:grid-cols-2">
        <Column id="a" name={nameA} setName={setNameA} text={textA} setText={setTextA} />
        <Column id="b" name={nameB} setName={setNameB} text={textB} setText={setTextB} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" icon={<ListChecks className="h-4 w-4" aria-hidden />}
          onClick={() => { setTextA(COMPARE_SAMPLES.a.join("\n")); setTextB(COMPARE_SAMPLES.b.join("\n")); setNameA("Laptop A"); setNameB("Laptop B"); }}>
          Load sample reviews
        </Button>
        <Button size="lg" loading={loading} disabled={invalid} onClick={run} icon={<GitCompareArrows className="h-4 w-4" aria-hidden />}>
          {loading ? "Comparing…" : "Compare products"}
        </Button>
      </div>

      <div className="mt-8" aria-live="polite">
        {error && <ErrorState message={error} onRetry={run} />}
        {!error && !res && !loading && <Card><EmptyState message="Add reviews for both products to compare them feature by feature." /></Card>}

        {res && (
          <div className="space-y-6">
            <Card className="animate-fade-up p-5 sm:p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Verdict</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{verdict}</p>
              <p className="mt-2 text-sm text-muted">
                Shared features compared: {both.length}. {res.nameA} wins {winsA}, {res.nameB} wins {winsB}, ties {ties}.
                {both.length === 0 && " No feature was mentioned for both products, so there is nothing to compare yet."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[{ n: res.nameA, r: res.a, c: COLOR_A }, { n: res.nameB, r: res.b, c: COLOR_B }].map((p) => (
                  <div key={p.n} className="rounded-lg border border-border p-3 text-sm">
                    <p className="flex items-center gap-2 font-semibold"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: p.c }} />{p.n}</p>
                    <p className="text-muted">{p.r.summary.reviews} reviews · {p.r.summary.aspects} aspects · ✓ {p.r.summary.positive} · ✕ {p.r.summary.negative} · – {p.r.summary.neutral}</p>
                  </div>
                ))}
              </div>
            </Card>

            {chart.length > 0 && (
              <Card>
                <CardHeader title="Net sentiment by feature" subtitle="Net score = (positive − negative) ÷ mentions. Right of zero is favourable." />
                <div className="p-4" style={{ height: Math.max(320, chart.length * 56 + 60) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} stroke={GRID} />
                      <XAxis type="number" domain={[-1, 1]} tick={TICK} />
                      <YAxis type="category" dataKey="aspect" width={120} tick={TICK} interval={0} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ color: "var(--color-muted)" }} />
                      <ReferenceLine x={0} stroke="var(--color-muted)" />
                      <Bar dataKey="a" name={res.nameA} fill={COLOR_A} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="b" name={res.nameB} fill={COLOR_B} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            <Card>
              <CardHeader title="Feature by feature" subtitle="✓ positive · ✕ negative · – neutral mentions. Small samples can be noisy." />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-bg text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Feature</th>
                      <th scope="col" className="px-4 py-3 font-medium">{res.nameA}</th>
                      <th scope="col" className="px-4 py-3 font-medium">{res.nameB}</th>
                      <th scope="col" className="px-4 py-3 font-medium">Better</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.aspect} className="border-t border-border">
                        <td className="px-4 py-3 font-medium capitalize">{r.aspect}</td>
                        <td className="px-4 py-3"><Counts x={r.a} /></td>
                        <td className="px-4 py-3"><Counts x={r.b} /></td>
                        <td className="px-4 py-3">
                          {r.winner === "A" && <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sentimentStyle("positive").badge}`}>{res.nameA}</span>}
                          {r.winner === "B" && <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sentimentStyle("positive").badge}`}>{res.nameB}</span>}
                          {r.winner === "tie" && <span className="text-muted">Tie</span>}
                          {r.winner === "n/a" && <span className="text-muted">n/a (one product only)</span>}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={4}><EmptyState message="No aspects were detected in these reviews." /></td></tr>}
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
