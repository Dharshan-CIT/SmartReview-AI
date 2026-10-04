import type { BatchResponse } from "../types";

/** Escape text for safe interpolation into an HTML string (the review text is user-supplied). */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SENT_LABEL: Record<string, string> = { positive: "✓ Positive", negative: "✕ Negative", neutral: "– Neutral" };
const SENT_COLOR: Record<string, string> = { positive: "#047857", negative: "#be123c", neutral: "#475569" };

/**
 * A self-contained, print-friendly HTML report for a batch of analyses. No PDF library is used:
 * the browser's own "Print… > Save as PDF" (triggered by the button in the page, or Ctrl/Cmd+P)
 * produces the PDF, which avoids an extra dependency and renders identically to what is on screen.
 */
export function buildReportHtml(data: BatchResponse, insights: string[]): string {
  const s = data.summary;
  const generated = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  const topAspectsRows = s.top_aspects.map((a) => `
    <tr><td>${esc(a.aspect)}</td><td>${a.total}</td><td style="color:${SENT_COLOR.positive}">${a.positive}</td>
    <td style="color:${SENT_COLOR.negative}">${a.negative}</td><td style="color:${SENT_COLOR.neutral}">${a.neutral}</td></tr>`).join("");

  const resultRows = data.results.map((r, i) => {
    const aspects = r.aspects.length
      ? r.aspects.map((a) => `<span class="chip" style="border-color:${SENT_COLOR[a.sentiment]};color:${SENT_COLOR[a.sentiment]}">${esc(a.text)}: ${SENT_LABEL[a.sentiment]}</span>`).join(" ")
      : '<span class="muted">No aspects detected</span>';
    return `<tr><td class="num">${i + 1}</td><td>${esc(r.review)}<div class="aspects">${aspects}</div></td><td>${esc(r.overall_sentiment.toUpperCase())}</td></tr>`;
  }).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>SmartReview AI — Batch Report</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Inter, Arial, sans-serif; color: #0f172a; max-width: 860px; margin: 0 auto; padding: 32px 24px 64px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: #64748b; font-size: 13px; margin: 0 0 24px; }
  h2 { font-size: 15px; margin: 28px 0 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
  .kpi .label { font-size: 11px; color: #64748b; }
  .kpi .value { font-size: 20px; font-weight: 700; }
  ul.insights { margin: 0; padding-left: 20px; }
  ul.insights li { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { color: #64748b; font-size: 11px; text-transform: uppercase; }
  td.num { color: #94a3b8; width: 28px; }
  .aspects { margin-top: 4px; }
  .chip { display: inline-block; border: 1px solid; border-radius: 999px; padding: 1px 8px; font-size: 11px; margin: 2px 4px 0 0; }
  .muted { color: #94a3b8; font-size: 12px; }
  .toolbar { position: sticky; top: 0; background: #fff; padding: 10px 0; margin-bottom: 8px; }
  .toolbar button { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 14px; cursor: pointer; }
  .toolbar button:hover { background: #4338ca; }
  footer { margin-top: 32px; font-size: 11px; color: #94a3b8; }
  @media print { .toolbar { display: none; } body { padding: 0; } }
</style></head>
<body>
  <div class="toolbar no-print"><button onclick="window.print()">Print / Save as PDF</button></div>
  <h1>SmartReview AI — Batch Analysis Report</h1>
  <p class="subtitle">Generated ${esc(generated)} · ${s.reviews} review${s.reviews === 1 ? "" : "s"} · aspect-based sentiment analysis (BERT)</p>

  <h2>Summary</h2>
  <div class="kpis">
    <div class="kpi"><div class="label">Reviews</div><div class="value">${s.reviews}</div></div>
    <div class="kpi"><div class="label">Aspects found</div><div class="value">${s.aspects}</div></div>
    <div class="kpi"><div class="label">Positive</div><div class="value" style="color:${SENT_COLOR.positive}">${s.positive}</div></div>
    <div class="kpi"><div class="label">Negative</div><div class="value" style="color:${SENT_COLOR.negative}">${s.negative}</div></div>
    <div class="kpi"><div class="label">Avg. confidence</div><div class="value">${Math.round(s.avg_confidence * 100)}%</div></div>
  </div>

  <h2>Key takeaways</h2>
  <ul class="insights">${insights.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>

  <h2>Most discussed features</h2>
  <table><thead><tr><th>Feature</th><th>Mentions</th><th>Positive</th><th>Negative</th><th>Neutral</th></tr></thead><tbody>${topAspectsRows}</tbody></table>

  <h2>All reviews</h2>
  <table><thead><tr><th></th><th>Review &amp; detected features</th><th>Overall</th></tr></thead><tbody>${resultRows}</tbody></table>

  <footer>SmartReview AI · Aspect-based sentiment analysis with BERT · Confidence scores are model probabilities, not guarantees.</footer>
</body></html>`;
}

/** Open the report in a new tab as a Blob URL (no server round-trip, no popup-triggering document.write). */
export function openReport(html: string): void {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
