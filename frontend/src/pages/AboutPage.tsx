import { BarChart3, GitCompareArrows, Layers, ListChecks, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardHeader, PageHeader } from "../components/ui/Card";

const FEATURES = [
  { to: "/analyze", icon: Sparkles, title: "Analyzer", text: "Paste one review. Every product feature it mentions is highlighted in the text and given a sentiment (positive, negative or neutral) with a confidence score. Open an aspect card to see the model's full probability breakdown." },
  { to: "/batch", icon: ListChecks, title: "Batch", text: "Paste many reviews (one per line) or upload a .txt or .csv file, up to 50 at a time. You get a report of the most praised and most criticised features and can export the results as CSV." },
  { to: "/compare", icon: GitCompareArrows, title: "Compare", text: "Give reviews for two products and see, feature by feature, which one customers like more." },
  { to: "/dashboard", icon: BarChart3, title: "Analytics", text: "Totals and trends across everything you have analyzed. Click a feature in the chart to see the reviews that mention it." },
  { to: "/history", icon: Layers, title: "History", text: "Every analyzed review is saved. Search, filter, sort, open the details, delete one, clear all, or export everything as CSV." },
];

const STEPS = [
  "Open the Analyzer and paste a product review, or press one of the example buttons (or Play demo).",
  "Press Analyze. The site finds the product features in the text (for example battery life or keyboard).",
  "For each feature it decides whether the customer is positive, negative or neutral, and shows how sure it is.",
  "A mixed review is never squashed into one label: the praise and the complaints are shown separately.",
  "Use Batch, Compare and Analytics when you have more than one review.",
];

const STACK = ["Python", "PyTorch", "Hugging Face Transformers", "BERT (bert-base-uncased)", "FastAPI", "SQLAlchemy + SQLite", "React + TypeScript", "Tailwind CSS", "Recharts"];

const GOOD_TO_KNOW = [
  "Works best on reviews of laptops, phones, cameras and similar electronics. Other kinds of products (for example clothing or food) were not tested and may be less accurate.",
  "Mild wording such as \"okay\" can be read as slightly positive, and unusual phrasing can produce unusual feature names.",
  "A ⚠ Low confidence label means the model is unsure. Treat those results with care.",
  "The sentiment is judged per feature, so one sentence can have several different answers.",
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="About SmartReview AI"
        subtitle="Understand what your customers really think, one product feature at a time."
      />

      <Card>
        <CardHeader title="What it is" />
        <div className="space-y-3 p-5 text-muted">
          <p>
            Most tools give a whole review a single score, such as &quot;positive&quot;. That hides what matters. A review that praises the screen and complains about the
            battery would come out as &quot;neutral&quot;, and you would not know what to fix.
          </p>
          <p>
            SmartReview AI reads the review the way a person would. First it finds <b>what</b> the customer is talking about (the features), then it works out <b>how they feel</b> about
            each one. This is called aspect-based sentiment analysis, and it is done by two BERT language models.
          </p>
        </div>
      </Card>

      <section aria-labelledby="features-h">
        <h2 id="features-h" className="mb-3 text-lg font-semibold">What you can do</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURES.map((f) => (
            <Link key={f.to} to={f.to} className="group block rounded-xl">
              <Card className="h-full p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-pop">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary-50 text-primary-ink"><f.icon className="h-5 w-5" aria-hidden /></div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="How to use it" />
          <ol className="list-decimal space-y-2 p-5 pl-9 text-muted">{STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
        </Card>
        <Card>
          <CardHeader title="Good to know" subtitle="Honest limits of the tool" />
          <ul className="list-disc space-y-2 p-5 pl-9 text-muted">{GOOD_TO_KNOW.map((s) => <li key={s}>{s}</li>)}</ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Your data" />
        <div className="flex gap-3 p-5 text-muted">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
          <p>
            The analysis runs on the computer that hosts this site. Analyzed reviews are stored in a local database on that computer, so you can browse and export them
            later, and you can delete any of them (or all of them) from the History page. The only outside request the page makes is loading its text font.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Built with" />
        <ul className="flex flex-wrap gap-2 p-5">{STACK.map((s) => <li key={s} className="rounded-full border border-border bg-bg px-3 py-1 text-sm">{s}</li>)}</ul>
        <div className="flex items-start gap-3 border-t border-border p-5 text-sm text-muted">
          <ScanSearch className="mt-0.5 h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
          <p>Two BERT models work in a row: one finds the features in the text, the other judges the sentiment of each feature.</p>
        </div>
      </Card>
    </div>
  );
}
