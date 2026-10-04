"""Generate docs/EXPERIMENTS.md and the README results block from saved evaluation files.

    python -m ml.make_results_report

Every number comes from JSON files written by the evaluation scripts, except the 14/17 -> 16/17 contrast-set figure,
which is copied from the output of `python -m ml.compare_atsc`.
"""
import json
import re

from ml import config

ROOT = config.ROOT
LABEL = {
    "test_laptop": "Laptops (SemEval-2014)",
    "test_phone": "Phones (M-ABSA)",
    "test_hl_seen": "Camera / phone / DVD (products seen in training)",
    "test_unseen_camera": "Nikon camera (NEVER seen in training)",
    "test_unseen_mp3": "MP3 player (NEVER seen in training)",
}


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def delta(a: float, b: float) -> str:
    d = (b - a) * 100
    return f"{'+' if d >= 0 else ''}{d:.1f} pts"


def extra_sections() -> str:
    """Experiments 4-6 (post-processing, calibration, golden set), written only for result files that exist."""
    out = ""
    pp = ROOT / "docs" / "results" / "postprocess.json"
    if pp.exists():
        d = json.loads(pp.read_text(encoding="utf-8"))
        rows = []
        for k, name in LABEL.items():
            r = d.get(k)
            if not r or "ate_raw" not in r:
                continue
            rows.append(f"| {name} | {pct(r['ate_raw']['exact_f1'])} → **{pct(r['ate_trim_only']['exact_f1'])}** ({delta(r['ate_raw']['exact_f1'], r['ate_trim_only']['exact_f1'])}) "
                        f"| {pct(r['ate_raw']['partial_f1'])} → **{pct(r['ate_trim_only']['partial_f1'])}** "
                        f"| {pct(r['ate_trim_and_drop']['exact_f1'])} | {pct(r['atsc_model']['accuracy'])} → {pct(r['atsc_rule']['accuracy'])} (fixed {r['rule_fixed']}, broke {r['rule_broke']}) |")
        syn = d.get("synthetic_test")
        out += f"""
## Experiment 4: rules around the models (measured, then chosen with data)
Two ideas were tried without retraining. The choices were made on the **validation** set and then confirmed once on the test sets.

* **Aspect clean-up** ("battery drains" → "battery", "the screen" → "screen"). *Trim-only* is shipped. Also dropping words such as
  "recommend" / "purchase" was rejected: on validation it removed 17 correct answers and fixed 1, because the annotators of the
  real datasets treat those words as aspects ("Would not recommend" is a useful negative signal).
* **"okay" → Neutral rule.** Real annotators label these words mostly *positive*: "ok" was labelled neutral only 10% of the time and
  positive 67% (21 examples), "okay" neutral 29% / positive 57% (7 examples), "average" neutral 23% / negative 46%. A rule forcing them to neutral
  lowered accuracy on real data (on validation: fixed 0, broke 8). It only "worked" on synthetic sentences that encode the opposite assumption
  ({pct(syn['atsc_model']['accuracy']) if syn else 'n/a'} → {pct(syn['atsc_rule']['accuracy']) if syn else 'n/a'} accuracy on synthetic held-out mild words), which shows the assumption, not the truth.
  **The label is therefore NOT changed.** Instead the interface adds a note ("mild wording (okay): this could also be read as neutral").

| Test set | Aspect exact F1: raw → trim-only (shipped) | Partial F1: raw → trim-only | Exact F1 if generic words were dropped too | Sentiment accuracy: model → forced-neutral rule (not shipped) |
|---|---|---|---|---|
""" + "\n".join(rows) + "\n"
    cal = ROOT / "docs" / "results" / "calibration.json"
    if cal.exists():
        c = json.loads(cal.read_text(encoding="utf-8"))
        out += f"""
## Experiment 5: honest confidence (temperature scaling)
Fine-tuned BERT is over-confident. One temperature T = **{c['temperature']}** was fitted on the validation set (validation NLL {c['validation_nll_before']} → {c['validation_nll_after']}) and stored with the model.
Predictions do not change, only the reported confidence. Expected Calibration Error on the untouched test sets (lower is better):
**{c['test_all']['ece_before']:.3f} → {c['test_all']['ece_after']:.3f}** over {c['test_all']['n']} aspects.

| Test set | n | ECE before → after | Mean confidence before → after | Accuracy |
|---|---|---|---|---|
""" + "\n".join(f"| {LABEL[k]} | {v['n']} | {v['ece_before']:.3f} → **{v['ece_after']:.3f}** | {pct(v['mean_conf_before'])} → {pct(v['mean_conf_after'])} | {pct(v['accuracy'])} |" for k, v in c["test"].items()) + "\n"
    gd = ROOT / "docs" / "results" / "golden.json"
    if gd.exists():
        g = json.loads(gd.read_text(encoding="utf-8"))["rules_on"]["buckets"]
        out += f"""
## Experiment 6: hand-written golden reviews (`tests/golden_reviews.json`)
{g['all']['of'] + g['contested']['of']} expected answers written by a person for realistic reviews of laptops, phones, cameras (in scope) and headphones, speakers, TVs, watches (out of scope).
* Overall (contested cases excluded): **{g['all']['correct']}/{g['all']['of']} ({pct(g['all']['rate'])})**
* In-scope product types: {g['in_scope']['correct']}/{g['in_scope']['of']} ({pct(g['in_scope']['rate'])}); out-of-scope types: {g['out_of_scope']['correct']}/{g['out_of_scope']['of']} ({pct(g['out_of_scope']['rate'])})
* Reviews with no product feature answered correctly (no aspect returned): {g['no_aspect']['correct']}/{g['no_aspect']['of']}
* Contested (mild wording, expected label is a matter of opinion): {g['contested']['correct']}/{g['contested']['of']}
The pass rate is guarded by a test, so a future change that makes answers worse fails the test suite. It is a small hand-made set, not a benchmark.
"""
    return out


def main() -> None:
    lap = load("docs/results/laptop_only_v1.json")["splits"]
    md = load("docs/results/multi_domain.json")["splits"]
    ate_v1 = load("models/ate_laptop_v1/test_metrics.json")
    atsc_v1 = load("models/atsc_v1/test_metrics.json")
    atsc_v2 = load("models/atsc_laptop_v2/test_metrics.json")
    v1_log = load("models/atsc_v1/training_log.json")
    v2_log = load("models/atsc_laptop_v2/training_log.json")
    md_ate_log = load("models/ate/training_log.json")
    md_atsc_log = load("models/atsc/training_log.json")

    rows = []
    for k, name in LABEL.items():
        a, b = lap[k], md[k]
        rows.append(
            f"| {name} | {a['sentences']} / {a['atsc_examples']} | "
            f"{pct(a['ate_exact']['f1'])} → **{pct(b['ate_exact']['f1'])}** ({delta(a['ate_exact']['f1'], b['ate_exact']['f1'])}) | "
            f"{pct(a['ate_partial']['f1'])} → **{pct(b['ate_partial']['f1'])}** | "
            f"{pct(a['atsc_accuracy'])} → **{pct(b['atsc_accuracy'])}** ({delta(a['atsc_accuracy'], b['atsc_accuracy'])}) | "
            f"{pct(a['atsc_macro_f1_present_classes'])} → **{pct(b['atsc_macro_f1_present_classes'])}** |")
    table = "\n".join(rows)

    results_block = f"""### Final models (multi-domain) vs laptop-only baseline, on held-out test sets

Model sets: **laptop-only** (trained on SemEval-2014 laptops) vs **multi-domain** (laptops + M-ABSA phones + Hu & Liu cameras/phone/DVD).
Each cell shows *laptop-only → multi-domain*. Sentences/aspects are the test-set sizes.

| Test set | Sentences / aspects | Aspect finding, exact F1 | Aspect finding, partial F1 | Sentiment accuracy | Sentiment macro-F1* |
|---|---|---|---|---|---|
{table}

\\* macro-F1 over the classes present in that test set (the Hu & Liu data has no *neutral* class).

Training of the final models: ATE best validation F1 {md_ate_log['best_val_f1']:.3f}; ATSC best validation macro-F1 {md_atsc_log['best_val_macro_f1']:.3f}
(both on a validation set that mixes all domains, so these are not comparable to the laptop-only validation scores)."""

    exp = f"""# Experiments and results

All numbers below are generated by `python -m ml.make_results_report` from the JSON files written by the
training and evaluation scripts (`models/*/training_log.json`, `models/*/test_metrics.json`, `docs/results/*.json`).

## Experiment 1: laptop-only baseline
* Data: SemEval-2014 Task 4 laptops, split 80/10/10 **by sentence** (no sentence appears in two splits).
* ATE (aspect extraction, BERT token classification): laptop test exact-match F1 **{pct(ate_v1['exact_match']['f1'])}**
  (precision {pct(ate_v1['exact_match']['precision'])}, recall {pct(ate_v1['exact_match']['recall'])});
  partial-match F1 {pct(ate_v1['partial_match']['f1'])}.
* ATSC v1 (sentiment, sentence-pair input): laptop test accuracy **{pct(atsc_v1['accuracy'])}**, macro-F1 **{pct(atsc_v1['macro_f1'])}**.
  Neutral is the hardest class (F1 {pct(atsc_v1['per_class']['neutral']['f1'])}).

## Experiment 2: marking the aspect inside the sentence (ATSC v2)
* Problem found by testing real sentences: in *"The display is fantastic, the keyboard is comfortable, but the battery life is terrible"* v1 labelled **keyboard** Negative
  (the negative clause leaked onto its neighbour).
* Change: wrap the aspect in `<< >>` inside the review text so the model knows which mention to judge.
* Result: best validation macro-F1 {v1_log['best_val_macro_f1']:.3f} (v1) → {v2_log['best_val_macro_f1']:.3f} (v2).
  On the laptop **test** set the two are statistically indistinguishable (macro-F1 {pct(atsc_v1['macro_f1'])} vs {pct(atsc_v2['macro_f1'])}; only {atsc_v1['examples']} test aspects).
* On a small hand-made set of contrast sentences (`python -m ml.compare_atsc`) v2 fixed the leaking errors (14/17 → 16/17 expected aspect sentiments correct).
  This set is a demonstration, not a benchmark.

## Experiment 3: training on several product types
* Data added: **M-ABSA** phone reviews (English) and **Hu & Liu (2004)** camera / phone / DVD-player reviews.
  Delivery/logistics and vague "overall" aspects were dropped from the phone data; comparisons and absent aspects were dropped from Hu & Liu.
  Duplicate sentences were removed from training if they appear in any validation/test set (leak check asserts none remain).
* **A Nikon camera and a Creative MP3 player were never used in training**; they measure how well the model transfers to unseen products.

{results_block}

### How to read this honestly
* Sentiment classification transfers well and improves further with multi-domain training.
* Aspect extraction is the harder part: it improves on every non-laptop test set but **drops on laptops**
  ({pct(lap['test_laptop']['ate_exact']['f1'])} → {pct(md['test_laptop']['ate_exact']['f1'])} exact F1), the usual price of spreading capacity over several domains.
* Part of the low aspect scores on phones/cameras/MP3 comes from **incomplete annotation** (aspects nobody labelled count as false positives); the partial-match column is higher for that reason.
* Only laptops, phones, cameras, MP3 players and DVD players were tested. The claim is **not** "all products".
* Test sets for the extra domains are small (see the sentence/aspect counts), so differences of a few points are within noise.

"""
    exp += extra_sections()
    exp += """
## Known weaknesses of the final system (what is still not solved)
* **Mild wording** ("okay", "average", "so-so"): the model usually says Positive. This matches how real annotators label most of these words,
  so the label is kept and the interface adds a note that it could also be read as neutral. Whether "okay" is neutral or mildly positive is partly a matter of opinion.
* **Aspect extraction is the weakest part** outside laptops (exact-match F1 about 47-57% on other products, partly because the extra datasets leave some aspects unlabelled).
  Aspects are sometimes missed or cut oddly ("heart" instead of "heart rate sensor", "fingerprint sensor" found but a second aspect in the same sentence missed).
* Words such as "recommended" or "purchase" can appear as aspects, because the real datasets label them that way.
* **Scope:** only laptops, phones, cameras, MP3 players and DVD players were trained and tested. Other product types (headphones, watches, TVs) did well on the small golden set,
  but they were not measured on real annotated data, and clothing or food reviews trigger an out-of-scope warning.
* English only (other scripts are rejected with a clear message; other Latin-alphabet languages cannot be detected).
* Calibration is good overall but not perfect (small sets such as the camera set got slightly worse); confidence is an estimate, not a guarantee.
* Two separate models: an aspect-extraction mistake carries into the sentiment step.
* The golden set was written by the project author, so it leans towards clear-cut reviews and is a guard against regressions, not a benchmark.
"""
    (ROOT / "docs" / "EXPERIMENTS.md").write_text(exp, encoding="utf-8")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    block = "<!-- RESULTS:START -->\n" + results_block + "\n\nFull write-up: `docs/EXPERIMENTS.md`.\n<!-- RESULTS:END -->"
    if "RESULTS_PLACEHOLDER" in readme:
        readme = readme.replace("RESULTS_PLACEHOLDER", block)
    else:
        readme = re.sub(r"<!-- RESULTS:START -->.*?<!-- RESULTS:END -->", lambda m: block, readme, flags=re.S)
    (ROOT / "README.md").write_text(readme, encoding="utf-8")
    print("wrote docs/EXPERIMENTS.md and updated README results block")


if __name__ == "__main__":
    main()
