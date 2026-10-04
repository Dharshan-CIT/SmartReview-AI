import { BarChart3, FileText, Layers, ScanSearch } from "lucide-react";

const STEPS = [
  { icon: FileText, title: "Review text", text: "Any product review, pasted or uploaded." },
  { icon: ScanSearch, title: "Find the features", text: "BERT #1 tags every word and extracts aspects such as battery life or keyboard." },
  { icon: Layers, title: "Judge each feature", text: "BERT #2 reads the review with each aspect and predicts positive, neutral or negative." },
  { icon: BarChart3, title: "Insights", text: "Highlights, reports, comparisons and analytics you can export." },
];

/** How the system works, as a connected flow. Responsive: a row on wide screens, a column on phones. */
export function PipelineDiagram() {
  return (
    <ol className="relative grid gap-6 md:grid-cols-4" aria-label="How SmartReview AI processes a review">
      {/* connecting line with a flowing highlight (desktop) */}
      <div aria-hidden className="pipeline-line pointer-events-none absolute left-[12.5%] right-[12.5%] top-7 hidden h-0.5 rounded-full md:block" />
      {/* connecting line (mobile) */}
      <div aria-hidden className="pipeline-line-v pointer-events-none absolute bottom-8 left-7 top-8 w-0.5 rounded-full md:hidden" />
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 md:block md:text-center">
          <div className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-primary-ink shadow-card md:mx-auto">
            <s.icon className="h-6 w-6" aria-hidden />
            <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-primary-600 text-xs font-semibold text-white">{i + 1}</span>
          </div>
          <div className="md:mt-4">
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
