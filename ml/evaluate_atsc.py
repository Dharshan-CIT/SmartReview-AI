"""Phase 10: evaluate the saved ATSC model on the held-out TEST split.

    python -m ml.evaluate_atsc
"""
import argparse

from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from ml import config
from ml.train_atsc import ATSCDataset, ID2LABEL, build_examples, collate, metrics, predict, read_mark_flag
from ml.utils import get_device, load_split, save_json


def evaluate(model_dir=config.ATSC_MODEL_DIR, split: str = "test", data_dir=None) -> dict:
    device = get_device()
    tok = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir).to(device).eval()
    examples = build_examples(load_split(split, data_dir), read_mark_flag(model_dir))
    dl = DataLoader(ATSCDataset(examples, tok), batch_size=32, collate_fn=lambda b: collate(b, tok.pad_token_id))
    gold, pred, probs = predict(model, dl, device)
    res = metrics(gold, pred)
    res.update({"split": split, "examples": len(examples)})
    res["errors"] = [
        {"text": e["text"], "aspect": e["aspect"], "gold": ID2LABEL[g], "predicted": ID2LABEL[p],
         "confidence": round(max(pr), 3)}
        for e, g, p, pr in zip(examples, gold, pred, probs) if g != p][:20]
    return res


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", default=str(config.ATSC_MODEL_DIR))
    ap.add_argument("--split", default="test")
    ap.add_argument("--data-dir", default=None, help="folder with <split>.json (default: data/processed)")
    args = ap.parse_args()
    res = evaluate(args.model_dir, args.split, args.data_dir)
    save_json(res, f"{args.model_dir}/{args.split}_metrics.json")
    print(f"{res['split']} examples: {res['examples']} | accuracy {res['accuracy']:.4f} | macro F1 {res['macro_f1']:.4f}")
    for k, v in res["per_class"].items():
        print(f"  {k:9s} P={v['precision']:.3f} R={v['recall']:.3f} F1={v['f1']:.3f}")
    print("Confusion matrix (rows=gold, cols=pred, order", res["label_order"], "):")
    for row in res["confusion_matrix"]:
        print("  ", row)


if __name__ == "__main__":
    main()
