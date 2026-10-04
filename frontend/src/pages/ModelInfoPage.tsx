import { useState } from "react";
import { Card, CardHeader, PageHeader } from "../components/ui/Card";
import { Spinner } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { PROJECT, isPlaceholder } from "../data/project";

/** One "label: value" line; hidden when the value is empty, and marked when it is still a TODO placeholder. */
function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  const todo = isPlaceholder(value);
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className={todo ? "text-mix" : ""}>{todo ? value.replace(/^TODO:\s*/, "") + " (not filled in yet)" : value}</dd>
    </div>
  );
}

/** Same as Detail, but the value is a clickable external link (used for GitHub). */
function DetailLink({ label, href }: { label: string; href: string }) {
  if (!href) return null;
  const todo = isPlaceholder(href);
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd>
        {todo ? (
          <span className="text-mix">{href.replace(/^TODO:\s*/, "")} (not filled in yet)</span>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-ink underline-offset-2 hover:underline">
            {href}
          </a>
        )}
      </dd>
    </div>
  );
}

const CONCEPTS = [
  { term: "ABSA", def: "Aspect-Based Sentiment Analysis. Instead of one sentiment for a whole review, it finds each product feature mentioned and the sentiment towards it." },
  { term: "ATE", def: "Aspect Term Extraction: find WHAT the customer talks about (e.g. \"battery life\"). We treat it as tagging every word of the review." },
  { term: "ATSC", def: "Aspect Term Sentiment Classification: decide HOW the customer feels about one aspect (positive, negative or neutral)." },
  { term: "Why BERT?", def: "BERT is a Transformer pre-trained on huge text. It reads a word together with its whole sentence (attention), so it knows \"cold\" in \"cold coffee\" differs from \"cold\" in \"cold shoulder\". Fine-tuning it on a small labelled dataset (transfer learning) works far better than training from scratch." },
  { term: "BIO tagging", def: "Every word gets one label: B-ASP (begins an aspect), I-ASP (continues it), O (not an aspect). \"battery life\" becomes B-ASP, I-ASP, so multi-word aspects stay together." },
];

const LIMITS = [
  "Domain coverage: trained on laptop, phone, camera, MP3-player and DVD-player reviews. Other product types (for example headphones, clothing) were not tested and may be less accurate.",
  "Small dataset (a few thousand aspect annotations), so rare aspects and the Neutral class are harder.",
  "Implicit aspects (\"it dies after an hour\" implies battery) are not detected: only explicit terms are.",
  "Sarcasm and ambiguous wording can fool the sentiment model.",
  "Two separate models: a wrong aspect boundary from ATE carries into ATSC.",
  "Not a replacement for reading reviews; confidence scores are model probabilities, not guarantees.",
];

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const DOMAIN_LABEL: Record<string, string> = {
  test_laptop: "Laptops",
  test_phone: "Phones",
  test_hl_seen: "Camera / phone / DVD reviews (products in training)",
  test_unseen_camera: "Nikon camera (never seen in training)",
  test_unseen_mp3: "MP3 player (never seen in training)",
};

function Delta({ a, b }: { a: number; b: number }) {
  const d = (b - a) * 100;
  const up = d >= 0.05;
  const down = d <= -0.05;
  return (
    <span className={`ml-2 text-xs font-semibold ${up ? "text-pos" : down ? "text-neg" : "text-muted"}`}>
      {up ? "▲" : down ? "▼" : "–"} {Math.abs(d).toFixed(1)}
    </span>
  );
}

const GOLDEN_BUCKET_LABEL: Record<string, string> = {
  all: "Overall", in_scope: "In-scope products", out_of_scope: "Out-of-scope products",
  no_aspect: "No-feature reviews", contested: "Contested (mild wording)",
};

export default function ModelInfoPage() {
  const { data, loading } = useAsync(api.modelInfo);
  const { data: feedback } = useAsync(api.feedbackSummary);
  const [showWrong, setShowWrong] = useState(false);
  const ate = data?.ate.test_metrics;
  const atsc = data?.atsc.test_metrics;
  const golden = data?.golden;

  return (
    <div className="space-y-8">
      <PageHeader title="How it works" subtitle="A transparent look at the models behind SmartReview AI, and how well they actually perform." />

      <Card>
        <CardHeader title="About the project and the team" subtitle="Academic project details" />
        <div className="p-5">
          <h3 className="text-lg font-semibold leading-snug">{PROJECT.title}</h3>
          <dl className="mt-3 divide-y divide-border">
            <Detail label="Programme" value={PROJECT.programme} />
            <Detail label="Department" value={PROJECT.department} />
            <Detail label="Course" value={PROJECT.course} />
            <Detail label="Institution" value={PROJECT.institution} />
            <Detail label="Academic year" value={PROJECT.academicYear} />
            <Detail label="Guide / faculty" value={PROJECT.guide} />
            <DetailLink label="GitHub" href={PROJECT.github} />
            <Detail label="Contact" value={PROJECT.contact} />
          </dl>

          <h4 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Team members</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Name</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Roll number</th>
                  <th scope="col" className="py-2 font-medium">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {PROJECT.team.map((m) => (
                  <tr key={m.name} className="border-t border-border">
                    <td className={`py-2.5 pr-3 font-medium ${isPlaceholder(m.name) ? "text-mix" : ""}`}>{m.name.replace(/^TODO:\s*/, "")}</td>
                    <td className={`py-2.5 pr-3 ${isPlaceholder(m.rollNumber) ? "text-mix" : ""}`}>{m.rollNumber.replace(/^TODO:\s*/, "")}</td>
                    <td className={`py-2.5 ${isPlaceholder(m.role) ? "text-mix" : "text-muted"}`}>{m.role.replace(/^TODO:\s*/, "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pipeline" />
        <ol className="grid gap-3 p-5 text-sm sm:grid-cols-5">
          {["Review text", "Text cleaning", "BERT ATE (finds aspects)", "BERT ATSC (judges each aspect)", "Results and analytics"].map((s, i) => (
            <li key={s} className="rounded-lg border border-border bg-bg p-3 text-center"><span className="block text-xs text-muted">Step {i + 1}</span><span className="font-medium">{s}</span></li>
          ))}
        </ol>
      </Card>

      <section aria-labelledby="concepts" className="grid gap-4 md:grid-cols-2">
        <h2 id="concepts" className="sr-only">Key concepts</h2>
        {CONCEPTS.map((c) => (
          <Card key={c.term} className="p-5"><h3 className="text-lg font-semibold">{c.term}</h3><p className="mt-1 text-muted">{c.def}</p></Card>
        ))}
      </section>

      <Card>
        <CardHeader title="Dataset" />
        <p className="p-5 text-muted">Training data: SemEval-2014 Task 4 laptop reviews, M-ABSA phone reviews, and the Hu & Liu (2004) camera, phone and DVD-player reviews. A camera and an MP3 player from Hu & Liu were kept completely unseen for testing. Sentences are split into train / validation / test as whole units, so the same review never appears on both sides of the split (no data leakage).</p>
      </Card>

      <Card>
        <CardHeader title="Measured performance" subtitle="Held-out laptop test set. Values below are read from the evaluation files produced by the evaluation scripts." />
        <div className="p-5">
          {loading && <Spinner />}
          {!loading && !ate && !atsc && <p className="text-muted">No evaluation results found yet. Train the models and run <code className="rounded bg-neu-bg px-1.5 py-0.5">python -m ml.evaluate_ate</code> and <code className="rounded bg-neu-bg px-1.5 py-0.5">python -m ml.evaluate_atsc</code>.</p>}
          <div className="grid gap-6 lg:grid-cols-2">
            {ate && (
              <div>
                <h3 className="mb-2 font-semibold">ATE: aspect extraction ({ate.sentences} test sentences)</h3>
                <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted"><tr><th className="py-1">Match type</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
                  <tbody>
                    {([["Exact match", ate.exact_match], ["Partial match", ate.partial_match]] as const).map(([n, m]) => (
                      <tr key={n} className="border-t border-border"><td className="py-2">{n}</td><td>{pct(m.precision)}</td><td>{pct(m.recall)}</td><td className="font-semibold">{pct(m.f1)}</td></tr>
                    ))}
                  </tbody></table>
              </div>
            )}
            {atsc && (
              <div>
                <h3 className="mb-2 font-semibold">ATSC: sentiment ({atsc.examples} test aspects)</h3>
                <p className="mb-2 text-sm">Accuracy <b>{pct(atsc.accuracy)}</b> · Macro F1 <b>{pct(atsc.macro_f1)}</b></p>
                <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted"><tr><th className="py-1">Class</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
                  <tbody>
                    {Object.entries(atsc.per_class).map(([n, m]) => (
                      <tr key={n} className="border-t border-border"><td className="py-2 capitalize">{n}</td><td>{pct(m.precision)}</td><td>{pct(m.recall)}</td><td className="font-semibold">{pct(m.f1)}</td></tr>
                    ))}
                  </tbody></table>
              </div>
            )}
          </div>
          {atsc && (
            <div className="mt-6">
              <h3 className="mb-2 font-semibold">ATSC confusion matrix (test set)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-[320px] text-center text-sm" aria-label="Confusion matrix: rows are true labels, columns are predictions">
                  <thead><tr><th className="p-2" /><th colSpan={atsc.label_order.length} className="p-2 text-xs font-medium uppercase tracking-wide text-muted">Predicted</th></tr>
                    <tr><th className="p-2 text-xs font-medium uppercase tracking-wide text-muted">True</th>{atsc.label_order.map((l) => <th key={l} scope="col" className="p-2 font-medium capitalize">{l}</th>)}</tr></thead>
                  <tbody>
                    {atsc.confusion_matrix.map((row, i) => {
                      const rowTotal = row.reduce((a, b) => a + b, 0) || 1;
                      return (
                        <tr key={i}>
                          <th scope="row" className="p-2 text-left font-medium capitalize">{atsc.label_order[i]}</th>
                          {row.map((v, j) => (
                            <td key={j} className="p-1">
                              <div className="grid h-14 min-w-[76px] place-items-center rounded-lg border border-border font-semibold"
                                style={{ background: `color-mix(in srgb, ${i === j ? "var(--color-primary-600)" : "var(--color-neg)"} ${Math.round((v / rowTotal) * 70)}%, transparent)` }}>
                                {v}<span className="text-[10px] font-normal text-muted">{Math.round((v / rowTotal) * 100)}%</span>
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">Diagonal (blue) = correct. Red cells show which classes get confused; percentages are per true class.</p>
            </div>
          )}
          <p className="mt-4 text-sm text-muted">Why F1 and Macro F1? Accuracy can look high when one class dominates. F1 balances precision (how many predictions were right) and recall (how many true cases were found); Macro F1 averages it over classes so the smaller Neutral class counts equally.</p>
        </div>
      </Card>

      {data?.cross_domain?.laptop_only_v1 && data.cross_domain.multi_domain && (
        <Card>
          <CardHeader
            title="Does it work on other products?"
            subtitle="Same test sets, two model sets: trained on laptops only vs trained on laptops + phones + cameras/DVD. Values are read from saved evaluation files."
          />
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2">Test set</th>
                  <th className="py-2">Aspect finding F1 (laptop-only → multi-domain)</th>
                  <th className="py-2">Sentiment accuracy (laptop-only → multi-domain)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(DOMAIN_LABEL).filter((k) => data.cross_domain!.multi_domain.splits[k] && data.cross_domain!.laptop_only_v1.splits[k]).map((k) => {
                  const a = data.cross_domain!.laptop_only_v1.splits[k];
                  const b = data.cross_domain!.multi_domain.splits[k];
                  return (
                    <tr key={k} className="border-t border-border">
                      <td className="py-3 pr-3 font-medium">{DOMAIN_LABEL[k]}</td>
                      <td className="py-3">{pct(a.ate_exact_f1)} → <b>{pct(b.ate_exact_f1)}</b><Delta a={a.ate_exact_f1} b={b.ate_exact_f1} /></td>
                      <td className="py-3">{pct(a.atsc_accuracy)} → <b>{pct(b.atsc_accuracy)}</b><Delta a={a.atsc_accuracy} b={b.atsc_accuracy} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-muted">
              Training on several product types clearly helps phones, cameras and MP3 players (including products never seen in training),
              at a cost in laptop aspect-finding. Some of the gap on other products comes from incomplete annotation in those datasets
              (aspects nobody labelled count as false positives). Arrows show percentage-point change.
            </p>
          </div>
        </Card>
      )}

      {golden && (
        <Card>
          <CardHeader
            title="Golden-review answer check"
            subtitle="Hand-written expected answers for realistic reviews (tests/golden_reviews.json), re-checked by the test suite on every run."
          />
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(golden.buckets).map(([k, b]) => (
                <div key={k} className="rounded-lg border border-border bg-bg p-3 text-center">
                  <p className="text-xs text-muted">{GOLDEN_BUCKET_LABEL[k] ?? k}</p>
                  <p className="text-xl font-semibold">{b.of ? pct(b.rate ?? 0) : "–"}</p>
                  <p className="text-xs text-muted">{b.correct}/{b.of}</p>
                </div>
              ))}
            </div>
            {golden.still_wrong.length > 0 && (
              <div className="mt-4">
                <button type="button" onClick={() => setShowWrong((v) => !v)} aria-expanded={showWrong}
                  className="text-sm font-medium text-primary-ink underline-offset-2 hover:underline">
                  {showWrong ? "Hide" : "Show"} the {golden.still_wrong.length} case{golden.still_wrong.length === 1 ? "" : "s"} still wrong
                </button>
                {showWrong && (
                  <ul className="mt-3 space-y-3 text-sm">
                    {golden.still_wrong.map((r) => (
                      <li key={r.review} className="rounded-lg border border-border p-3">
                        <p className="font-medium">{r.review}</p>
                        <p className="mt-1 text-muted">
                          Expected: {r.expected === "none" ? "no aspects" : Object.entries(r.expected).map(([a, s]) => `${a} → ${s}`).join(", ")}
                          {" · "}
                          Got: {r.got.length === 0 ? "no aspects" : r.got.map(([a, s]) => `${a} → ${s}`).join(", ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <p className="mt-4 text-sm text-muted">
              This is a small, author-written set (not a benchmark) — it exists to catch regressions, not to prove accuracy. "Contested" cases
              are ones where the expected label depends on reading mild wording as Neutral rather than Positive; see Experiment 4 in docs/EXPERIMENTS.md.
            </p>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Community feedback"
          subtitle="Thumbs up/down left by anyone using the Analyzer or Batch pages. In production this is exactly the signal you would use to pick which aspects to re-label and fine-tune on."
        />
        <div className="p-5">
          {!feedback && <Spinner />}
          {feedback && feedback.total_votes === 0 && (
            <p className="text-muted">No feedback has been left yet. Vote 👍/👎 on an aspect card in the Analyzer or Batch results to see it here.</p>
          )}
          {feedback && feedback.total_votes > 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-bg p-3 text-center"><p className="text-xs text-muted">Total votes</p><p className="text-xl font-semibold">{feedback.total_votes}</p></div>
                <div className="rounded-lg border border-border bg-bg p-3 text-center"><p className="text-xs text-muted">👍 Agree</p><p className="text-xl font-semibold text-pos">{feedback.thumbs_up}</p></div>
                <div className="rounded-lg border border-border bg-bg p-3 text-center"><p className="text-xs text-muted">👎 Disagree</p><p className="text-xl font-semibold text-neg">{feedback.thumbs_down}</p></div>
              </div>
              {feedback.agreement_rate != null && (
                <p className="mt-3 text-sm text-muted">Agreement rate: <b className="text-text">{pct(feedback.agreement_rate)}</b></p>
              )}
              {feedback.most_disputed.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Most disputed results</p>
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-1 pr-3">Aspect</th><th className="pr-3">Predicted</th><th className="pr-3">👍</th><th>👎</th></tr></thead>
                    <tbody>
                      {feedback.most_disputed.map((d) => (
                        <tr key={d.aspect_id} className="border-t border-border">
                          <td className="py-2 pr-3 font-medium capitalize">{d.term}</td>
                          <td className="pr-3 capitalize">{d.sentiment}</td>
                          <td className="pr-3 text-pos">{d.thumbs_up}</td>
                          <td className="text-neg">{d.thumbs_down}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Limitations" subtitle="What this system cannot do reliably" />
        <ul className="list-disc space-y-2 p-5 pl-9 text-muted">{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
      </Card>
    </div>
  );
}
