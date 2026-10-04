import { Download, Eye, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HighlightedReview } from "../components/HighlightedReview";
import { SentimentBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { EmptyState, ErrorState, Spinner } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import type { AnalysisResult } from "../types";
import { formatDate, truncate } from "../utils/format";

const field = "h-10 rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export default function HistoryPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const aspect = params.get("aspect") ?? "";
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [sort, setSort] = useState("date");
  const [order, setOrder] = useState("desc");
  const [detail, setDetail] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, error, loading, reload } = useAsync(
    () => api.history({ search: debounced, sentiment, aspect, sort, order, limit: 100 }),
    [debounced, sentiment, aspect, sort, order],
  );

  async function open(id: number) {
    try {
      setDetail(await api.historyItem(id));
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this review from your history?")) return;
    try {
      await api.deleteHistory(id);
      toast("success", "Review deleted.");
      reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  const filtered = Boolean(debounced || sentiment || aspect);

  async function clearAll() {
    if (!window.confirm("Delete ALL analyzed reviews from your history? This cannot be undone.")) return;
    try {
      const r = await api.clearHistory();
      toast("success", `Deleted ${r.deleted} review${r.deleted === 1 ? "" : "s"}.`);
      reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Review History"
        subtitle="Every review you've analyzed. Search, filter, and open any past result."
        action={
          <div className="flex gap-2">
            <a href={api.historyExportUrl({ search: debounced, sentiment, aspect })} download
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-primary-50">
              <Download className="h-4 w-4" aria-hidden /> Export CSV
            </a>
            <Button variant="ghost" size="sm" className="h-10" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={clearAll} disabled={!data?.total}>Clear all</Button>
          </div>
        }
      />
      {aspect && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-sm text-primary-ink">
          Reviews mentioning <b className="capitalize">{aspect}</b>
          <button aria-label="Remove aspect filter" onClick={() => setParams({})} className="rounded-full p-0.5 hover:bg-primary-100"><X className="h-4 w-4" /></button>
        </p>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input aria-label="Search reviews" placeholder="Search reviews…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${field} w-full pl-9`} />
          </div>
          <select aria-label="Filter by sentiment" value={sentiment} onChange={(e) => setSentiment(e.target.value)} className={field}>
            <option value="">All sentiments</option>
            {["positive", "negative", "neutral", "mixed", "none"].map((s) => <option key={s} value={s}>{s === "none" ? "No aspects" : s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)} className={field}>
            <option value="date">Sort: Date</option>
            <option value="aspects">Sort: Aspects</option>
            <option value="sentiment">Sort: Sentiment</option>
          </select>
          <select aria-label="Order" value={order} onChange={(e) => setOrder(e.target.value)} className={field}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        {loading && !data && <Spinner label="Loading history…" />}
        {error && <div className="p-4"><ErrorState message={error} onRetry={reload} /></div>}

        {data && data.items.length === 0 && (
          <EmptyState
            title={filtered ? "No matching reviews" : "No reviews yet"}
            message={filtered ? "Try a different search or filter." : "Analyzed reviews will appear here."}
            action={!filtered && <Link to="/analyze"><Button>Analyze a review</Button></Link>}
          />
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-bg text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Review</th>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Overall</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">Aspects</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium"><span aria-label="Positive">✓</span></th>
                  <th scope="col" className="px-4 py-3 text-center font-medium"><span aria-label="Negative">✕</span></th>
                  <th scope="col" className="px-4 py-3 text-center font-medium"><span aria-label="Neutral">–</span></th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-primary-50/40">
                    <td className="max-w-xs px-4 py-3">{truncate(r.text, 80)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3"><SentimentBadge sentiment={r.overall_sentiment} /></td>
                    <td className="px-4 py-3 text-center font-medium">{r.n_aspects}</td>
                    <td className="px-4 py-3 text-center text-pos">{r.n_positive}</td>
                    <td className="px-4 py-3 text-center text-neg">{r.n_negative}</td>
                    <td className="px-4 py-3 text-center text-neu">{r.n_neutral}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" aria-label={`View details for review ${r.id}`} onClick={() => open(r.id)} icon={<Eye className="h-4 w-4" />}>View</Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete review ${r.id}`} onClick={() => remove(r.id)} icon={<Trash2 className="h-4 w-4" />}><span className="sr-only">Delete</span></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-3 text-xs text-muted">Showing {data.items.length} of {data.total}</p>
          </div>
        )}
      </Card>

      <Modal open={detail !== null} title="Review details" onClose={() => setDetail(null)}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3"><SentimentBadge sentiment={detail.overall_sentiment} /><span className="text-sm text-muted">{formatDate(detail.created_at)}</span></div>
            <HighlightedReview text={detail.review} aspects={detail.aspects} />
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {detail.aspects.length === 0 && <li className="p-3 text-muted">No aspects detected.</li>}
              {detail.aspects.map((a) => (
                <li key={a.start} className="flex items-center justify-between p-3">
                  <span className="font-medium capitalize">{a.text}</span>
                  <span className="flex items-center gap-3"><SentimentBadge sentiment={a.sentiment} /><span className="w-10 text-right text-muted">{Math.round(a.confidence * 100)}%</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
