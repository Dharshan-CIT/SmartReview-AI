"""Measure what the post-processing rules do on held-out data (with the rules OFF vs ON).

    python -m ml.eval_postprocess

ATE:  exact / partial span F1 on gold sentences: raw spans vs trim-only (shipped) vs trim + drop generic terms.
ATSC: accuracy / macro-F1 on gold aspects, model only vs model + mild-wording rule.
Also measured on data/processed_md/synthetic_test.json (SYNTHETIC mild wording the model never saw in training).
Results are saved to docs/results/postprocess.json.
"""
import copy
import warnings

warnings.filterwarnings("ignore")

from sklearn.metrics import accuracy_score, f1_score  # noqa: E402

from ml import config  # noqa: E402
from ml.inference import ABSAPipeline  # noqa: E402
from ml.experiments.rejected_rules import apply_mild_rule  # noqa: E402  (NOT shipped; kept for this experiment)
from ml.postprocess import clean_spans  # noqa: E402
from ml.utils import load_split, save_json  # noqa: E402

DATA = config.ROOT / "data" / "processed_md"
SPLITS = ["test_laptop", "test_phone", "test_hl_seen", "test_unseen_camera", "test_unseen_mp3"]
LABELS = config.ATSC_LABELS


def overlaps(a, b):
    return a["start"] < b["end"] and b["start"] < a["end"]


def ate_scores(rows, predicted):
    """exact and partial P/R/F1 over all sentences."""
    tp_exact = tp_partial_p = tp_partial_r = n_pred = n_gold = 0
    for s, spans in zip(rows, predicted):
        gold = s["aspects"]
        n_pred += len(spans)
        n_gold += len(gold)
        keys = {(g["start"], g["end"]) for g in gold}
        tp_exact += sum((p["start"], p["end"]) in keys for p in spans)
        tp_partial_p += sum(any(overlaps(p, g) for g in gold) for p in spans)
        tp_partial_r += sum(any(overlaps(g, p) for p in spans) for g in gold)

    def f(tp_p, tp_r):
        p = tp_p / n_pred if n_pred else 0.0
        r = tp_r / n_gold if n_gold else 0.0
        return round(2 * p * r / (p + r), 4) if p + r else 0.0
    return {"exact_f1": f(tp_exact, tp_exact), "partial_f1": f(tp_partial_p, tp_partial_r), "predicted": n_pred, "gold": n_gold}


def atsc_scores(gold, pred):
    present = sorted(set(gold))
    return {"accuracy": round(float(accuracy_score(gold, pred)), 4),
            "macro_f1": round(float(f1_score(gold, pred, average="macro", labels=present, zero_division=0)), 4),
            "n": len(gold)}


def main() -> None:
    pipe = ABSAPipeline()
    out = {}
    print(f"{'test set':20s} | ATE exact F1 raw -> trim | ATE partial F1 raw -> trim | ATSC acc model -> +rule | ATSC macroF1 model -> +rule")
    for name in SPLITS + ["synthetic_test"]:
        rows = load_split(name, DATA)
        row = {}
        if name != "synthetic_test":
            texts = [s["text"] for s in rows]
            raw = pipe.extract_aspects_many(texts)
            trimmed = [clean_spans(t, sp, drop_generic=False) for t, sp in zip(texts, raw)]
            cleaned = [clean_spans(t, sp) for t, sp in zip(texts, raw)]
            row["ate_raw"] = ate_scores(rows, raw)
            row["ate_trim_only"] = ate_scores(rows, trimmed)
            row["ate_trim_and_drop"] = ate_scores(rows, cleaned)

        # sentiment on GOLD aspects (isolates the sentiment model + rule from extraction errors)
        items = [(s["text"], a) for s in rows for a in s["aspects"] if a["polarity"] in LABELS]
        texts = [t for t, _ in items]
        aspect_lists = [[{"term": a["term"], "start": a["start"], "end": a["end"]}] for _, a in items]
        res = [r[0] for r in pipe.classify_many(texts, aspect_lists)]
        gold = [a["polarity"] for _, a in items]
        base = [r["sentiment"] for r in res]
        with_rule = [apply_mild_rule(t, [copy.deepcopy(r)])[0]["sentiment"] for t, r in zip(texts, res)]
        row["atsc_model"] = atsc_scores(gold, base)
        row["atsc_rule"] = atsc_scores(gold, with_rule)
        row["rule_changed"] = sum(b != w for b, w in zip(base, with_rule))
        row["rule_fixed"] = sum(b != g and w == g for b, w, g in zip(base, with_rule, gold))
        row["rule_broke"] = sum(b == g and w != g for b, w, g in zip(base, with_rule, gold))
        out[name] = row
        e = row.get("ate_raw"), row.get("ate_trim_only")
        print(f"{name:20s} | "
              + (f"{e[0]['exact_f1']:.3f} -> {e[1]['exact_f1']:.3f}         | {e[0]['partial_f1']:.3f} -> {e[1]['partial_f1']:.3f}           | " if e[0] else "n/a                       | n/a                         | ")
              + f"{row['atsc_model']['accuracy']:.3f} -> {row['atsc_rule']['accuracy']:.3f}       | {row['atsc_model']['macro_f1']:.3f} -> {row['atsc_rule']['macro_f1']:.3f}"
              + f"   (rule changed {row['rule_changed']}: fixed {row['rule_fixed']}, broke {row['rule_broke']})")
    save_json(out, config.ROOT / "docs" / "results" / "postprocess.json")


if __name__ == "__main__":
    main()
