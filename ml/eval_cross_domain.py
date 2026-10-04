"""Evaluate an ATE + ATSC model pair on several domain test sets and print / save a comparison table.

    python -m ml.eval_cross_domain --name laptop_only --ate models/ate --atsc models/atsc
    python -m ml.eval_cross_domain --name multi_domain --ate models/ate_md --atsc models/atsc_md

Reads data/processed_md/test_*.json (built by ml.preprocessing.prepare_multidomain).
Results are saved to docs/results/<name>.json. Nothing is typed by hand.
"""
import argparse

from ml import config
from ml.evaluate_ate import evaluate as eval_ate
from ml.evaluate_atsc import evaluate as eval_atsc
from ml.utils import save_json

DATA = config.ROOT / "data" / "processed_md"
SPLITS = ["test_laptop", "test_phone", "test_hl_seen", "test_unseen_camera", "test_unseen_mp3"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--ate", required=True)
    ap.add_argument("--atsc", required=True)
    ap.add_argument("--splits", nargs="*", default=SPLITS)
    args = ap.parse_args()

    out = {"name": args.name, "ate_model": args.ate, "atsc_model": args.atsc, "splits": {}}
    print(f"\n== {args.name} ==")
    print(f"{'test set':22s} {'ATE exact F1':>13s} {'ATE partial F1':>15s} {'ATSC acc':>9s} {'ATSC macroF1*':>14s}")
    for sp in args.splits:
        a = eval_ate(args.ate, sp, DATA)
        s = eval_atsc(args.atsc, sp, DATA)
        row = {"sentences": a["sentences"], "ate_exact": a["exact_match"], "ate_partial": a["partial_match"],
               "atsc_examples": s["examples"], "atsc_accuracy": s["accuracy"], "atsc_macro_f1": s["macro_f1"],
               "atsc_macro_f1_present_classes": s["macro_f1_present_classes"], "atsc_per_class": s["per_class"],
               "atsc_confusion_matrix": s["confusion_matrix"]}
        out["splits"][sp] = row
        print(f"{sp:22s} {a['exact_match']['f1']:13.3f} {a['partial_match']['f1']:15.3f} "
              f"{s['accuracy']:9.3f} {s['macro_f1_present_classes']:14.3f}")
    print("* macro-F1 over the classes present in that test set (Hu&Liu has no neutral class)")
    save_json(out, config.ROOT / "docs" / "results" / f"{args.name}.json")


if __name__ == "__main__":
    main()
