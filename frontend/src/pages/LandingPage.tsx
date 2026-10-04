import { ArrowRight, BarChart3, GitCompareArrows, ListChecks, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { PipelineDiagram } from "../components/PipelineDiagram";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CountUp, Reveal } from "../hooks/useMotion";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

const BENEFITS = [
  { icon: Zap, title: "Fast", text: "About a quarter of a second per review on a laptop CPU." },
  { icon: ShieldCheck, title: "Honest", text: "Low-confidence results are flagged, and measured accuracy is shown openly." },
  { icon: Sparkles, title: "Explainable", text: "Every aspect is highlighted right inside the original review." },
];

const TOOLS = [
  { to: "/analyze", icon: Sparkles, title: "Analyze a review", text: "Paste one review, see every feature highlighted with its sentiment and confidence." },
  { to: "/batch", icon: ListChecks, title: "Batch report", text: "Upload up to 50 reviews (.txt or .csv) and get a feature-level report you can export." },
  { to: "/compare", icon: GitCompareArrows, title: "Compare products", text: "Put two products side by side and see which one wins on each feature." },
  { to: "/dashboard", icon: BarChart3, title: "Analytics", text: "Track what customers praise and criticise, then click through to the reviews." },
];

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function LandingPage() {
  const { data } = useAsync(api.modelInfo);
  const ate = data?.ate.test_metrics;
  const atsc = data?.atsc.test_metrics;
  const stats = [
    ate && { label: "Aspect extraction F1", value: ate.exact_match.f1 },
    atsc && { label: "Sentiment accuracy", value: atsc.accuracy },
    atsc && { label: "Sentiment macro-F1", value: atsc.macro_f1 },
  ].filter(Boolean) as { label: string; value: number }[];

  return (
    <div className="-mt-10 space-y-28">
      {/* ------------------------------------------------------------ hero */}
      <section className="bg-hero relative -mx-4 overflow-hidden px-4 pb-24 pt-20 sm:-mx-6 sm:px-6">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="orb orb-indigo -left-24 top-10 h-72 w-72" />
        <div aria-hidden className="orb orb-teal -right-20 top-40 h-80 w-80" />
        <div aria-hidden className="orb orb-violet left-1/3 -top-24 h-64 w-64" />

        <div className="animate-fade-up relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-sm font-medium text-primary-ink shadow-card backdrop-blur">
            <span aria-hidden className="h-2 w-2 animate-pulse-dot rounded-full bg-pos" />
            Aspect-Based Sentiment Analysis · BERT
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.06] tracking-tight sm:text-6xl">
            Understand What Your Customers <span className="text-gradient">Really Think.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">AI-powered aspect-based sentiment analysis for e-commerce reviews.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/analyze"><Button size="lg" className="shadow-glow" icon={<ArrowRight className="h-4 w-4" aria-hidden />}>Analyze a Review</Button></Link>
            <Link to="/dashboard"><Button size="lg" variant="secondary">Explore Analytics</Button></Link>
          </div>

          {stats.length > 0 && (
            <>
              <dl className="stagger mx-auto mt-16 grid max-w-2xl gap-4 sm:grid-cols-3">
                {stats.map((s) => (
                  <div key={s.label} className="hover-lift relative overflow-hidden rounded-2xl border border-border bg-surface/90 p-5 shadow-card backdrop-blur">
                    <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-600 via-violet-500 to-teal-400" />
                    <dt className="text-xs font-medium text-muted">{s.label}</dt>
                    <dd className="mt-1 text-4xl font-bold tracking-tight"><CountUp value={s.value} format={pct} /></dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted">Measured on a held-out laptop test set. Phones, cameras and MP3 players were tested separately.</p>
            </>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section aria-labelledby="how" className="mx-auto max-w-6xl">
        <Reveal>
          <h2 id="how" className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted">One overall score hides the story. SmartReview AI finds each feature, then judges how the customer feels about it.</p>
        </Reveal>
        <Reveal delay={120} className="mt-14"><PipelineDiagram /></Reveal>
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 100}>
              <div className="hover-lift flex h-full items-start gap-3 rounded-xl border border-border bg-surface p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-ink"><b.icon className="h-5 w-5" aria-hidden /></div>
                <div><p className="font-semibold">{b.title}</p><p className="mt-0.5 text-sm text-muted">{b.text}</p></div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ tools */}
      <section aria-labelledby="tools" className="mx-auto max-w-6xl">
        <Reveal><h2 id="tools" className="text-center text-3xl font-semibold tracking-tight">What you can do</h2></Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((t, i) => (
            <Reveal key={t.to} delay={i * 90}>
              <Link to={t.to} className="group block h-full rounded-xl focus-visible:outline-offset-4">
                <Card className="hover-lift h-full p-5">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary-600 to-violet-600 text-white shadow-glow"><t.icon className="h-5 w-5" aria-hidden /></div>
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="mt-1 text-sm text-muted">{t.text}</p>
                  <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-ink">Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></p>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ call to action */}
      <section className="mx-auto max-w-6xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-violet-600 to-indigo-700 p-10 text-center text-white shadow-glow sm:p-14">
            <div aria-hidden className="orb orb-teal -right-10 -top-10 h-56 w-56 opacity-60" />
            <div aria-hidden className="orb orb-violet -bottom-16 -left-10 h-56 w-56 opacity-60" />
            <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">Try it on a real review</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">Paste any product review, or pick an example, and watch the features light up.</p>
            <Link to="/analyze" className="relative mt-8 inline-block">
              <span className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 font-semibold text-primary-700 shadow-pop transition-transform hover:-translate-y-0.5">
                Open the Analyzer <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
