"""Phase 8: evaluate the saved ATE model on the held-out TEST split.

    python -m ml.evaluate_ate
Reports exact-match and partial-match aspect metrics, word-level metrics, and error examples.
All numbers come from actually running the model.
"""
import argparse

import torch
from sklearn.metrics import classification_report
from transformers import AutoModelForTokenClassification, AutoTokenizer

from ml import config
from ml.preprocessing.bio import ID2LABEL, IGNORE, decode_bio, encode_with_labels
from ml.utils import get_device, load_split, save_json


@torch.no_grad()
def predict_sentence(model, tokenizer, text: str, device, max_len: int = config.MAX_LEN):
    """Return (predicted aspect spans, per-word predicted label ids, per-word gold-aligned token index)."""
    enc = encode_with_labels(text, [], tokenizer, max_len)
    ids = torch.tensor([enc["input_ids"]], device=device)
    mask = torch.tensor([enc["attention_mask"]], device=device)
    pred = model(input_ids=ids, attention_mask=mask).logits.argmax(-1)[0].tolist()
    spans = decode_bio(text, enc["offset_mapping"], enc["word_ids"], pred)
    return spans, pred, enc


def prf(tp: int, n_pred: int, n_gold: int) -> dict:
    p = tp / n_pred if n_pred else 0.0
    r = tp / n_gold if n_gold else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return {"precision": p, "recall": r, "f1": f, "tp": tp, "predicted": n_pred, "gold": n_gold}


def overlaps(a: dict, b: dict) -> bool:
    return a["start"] < b["end"] and b["start"] < a["end"]


def evaluate(model_dir=config.ATE_MODEL_DIR, split: str = "test", data_dir=None) -> dict:
    device = get_device()
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForTokenClassification.from_pretrained(model_dir).to(device).eval()
    rows = load_split(split, data_dir)

    exact_tp = partial_tp = partial_recall_tp = n_pred = n_gold = 0
    word_gold, word_pred = [], []
    false_pos, false_neg = [], []
    for s in rows:
        spans, pred, enc = predict_sentence(model, tokenizer, s["text"], device)
        gold = s["aspects"]
        n_pred += len(spans)
        n_gold += len(gold)
        gold_keys = {(g["start"], g["end"]) for g in gold}
        exact_tp += sum((p["start"], p["end"]) in gold_keys for p in spans)
        # partial: prediction counts if it overlaps any gold aspect (each pred counted once)
        partial_tp += sum(any(overlaps(p, g) for g in gold) for p in spans)
        for p in spans:
            if not any(overlaps(p, g) for g in gold):
                false_pos.append({"text": s["text"], "predicted": p["term"]})
        for g in gold:
            if any(overlaps(g, p) for p in spans):
                partial_recall_tp += 1
            else:
                false_neg.append({"text": s["text"], "missed": g["term"]})
        # word-level (first subword of each word)
        gold_enc = encode_with_labels(s["text"], gold, tokenizer)
        for j, gl in enumerate(gold_enc["labels"]):
            if gl != IGNORE:
                word_gold.append(ID2LABEL[gl])
                word_pred.append(ID2LABEL[pred[j]])

    result = {
        "split": split, "sentences": len(rows),
        "exact_match": prf(exact_tp, n_pred, n_gold),
        "partial_match": {**prf(partial_tp, n_pred, n_gold),
                          "recall": partial_recall_tp / n_gold if n_gold else 0.0},
        "word_level_report": classification_report(word_gold, word_pred, labels=config.ATE_LABELS,
                                                   output_dict=True, zero_division=0),
        "false_positive_examples": false_pos[:15], "false_negative_examples": false_neg[:15],
        "n_false_positive": len(false_pos), "n_false_negative": len(false_neg),
    }
    pm = result["partial_match"]
    pm["f1"] = 2 * pm["precision"] * pm["recall"] / (pm["precision"] + pm["recall"]) if pm["precision"] + pm["recall"] else 0.0
    return result


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", default=str(config.ATE_MODEL_DIR))
    ap.add_argument("--split", default="test")
    ap.add_argument("--data-dir", default=None, help="folder with <split>.json (default: data/processed)")
    args = ap.parse_args()
    res = evaluate(args.model_dir, args.split, args.data_dir)
    save_json(res, f"{args.model_dir}/{args.split}_metrics.json")
    for k in ("exact_match", "partial_match"):
        m = res[k]
        print(f"{k:14s} P={m['precision']:.4f} R={m['recall']:.4f} F1={m['f1']:.4f}  (tp={m['tp']}, pred={m['predicted']}, gold={m['gold']})")
    print("Word-level:", {l: round(res['word_level_report'][l]['f1-score'], 4) for l in config.ATE_LABELS})
    print(f"False positives: {res['n_false_positive']} | False negatives: {res['n_false_negative']}")
    print("Sample misses:", res["false_negative_examples"][:3])


if __name__ == "__main__":
    main()
