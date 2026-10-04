import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { TOOLTIP_STYLE } from "../utils/chart";
import { SENTIMENTS, sentimentStyle } from "../utils/sentiment";

type Counts = { positive: number; negative: number; neutral: number };

/** Count list + donut. The list repeats the numbers as text, so the chart is never the only source. */
export function SentimentChart({ counts, height = 180 }: { counts: Counts; height?: number }) {
  const total = counts.positive + counts.negative + counts.neutral;
  const data = SENTIMENTS.map((s) => ({ name: sentimentStyle(s).label, value: counts[s], color: sentimentStyle(s).hex }));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative w-full max-w-[180px]" style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={total ? data : [{ name: "None", value: 1, color: "var(--color-border)" }]} dataKey="value" innerRadius="66%" outerRadius="100%" paddingAngle={total ? 3 : 0} stroke="none">
              {(total ? data : [{ color: "var(--color-border)" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            {total > 0 && <Tooltip {...TOOLTIP_STYLE} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{total}</span>
          <span className="text-xs text-muted">aspects</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {SENTIMENTS.map((s) => {
          const st = sentimentStyle(s);
          return (
            <li key={s} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: st.hex }} />
                <span aria-hidden>{st.icon}</span> {st.label}
              </span>
              <span className="font-semibold">{counts[s]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
