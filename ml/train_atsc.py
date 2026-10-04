"""Phase 9: fine-tune BERT for Aspect Term Sentiment Classification (ATSC).

Input is a sentence PAIR:  [CLS] review text [SEP] aspect term [SEP]
so the model knows WHICH aspect to judge. Without the aspect, a mixed review like
"great screen but terrible battery" has no single correct label.

    python -m ml.train_atsc
    python -m ml.train_atsc --smoke --max-train 64 --epochs 1 --out-dir <folder>
"""
import argparse
import time
from collections import Counter

import torch
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_recall_fscore_support
from torch.utils.data import DataLoader, Dataset
from transformers import (AutoModelForSequenceClassification, BertConfig, BertForSequenceClassification,
                          get_linear_schedule_with_warmup)

from ml import config
from ml.preprocessing.bio import get_tokenizer
from ml.utils import get_device, load_split, save_json, set_seed

LABEL2ID = {l: i for i, l in enumerate(config.ATSC_LABELS)}
ID2LABEL = {i: l for l, i in LABEL2ID.items()}


def mark_aspect(text: str, start: int, end: int) -> str:
    """Wrap the aspect occurrence in << >> so the model knows exactly WHICH mention to judge.

    "The screen is great but the battery is bad"  ->  "... but the << battery >> is bad"
    This keeps the sentence-pair input but adds LOCAL position information, reducing
    sentiment 'leaking' from a neighbouring clause onto the wrong aspect.
    """
    return f"{text[:start]}<< {text[start:end]} >>{text[end:]}"


def build_examples(sentences: list[dict], mark: bool = False) -> list[dict]:
    """One example per (sentence, aspect). 'conflict' aspects are excluded (only 3 classes)."""
    return [{"text": mark_aspect(s["text"], a["start"], a["end"]) if mark else s["text"],
             "aspect": a["term"], "label": LABEL2ID[a["polarity"]]}
            for s in sentences for a in s["aspects"] if a["polarity"] in LABEL2ID]


def read_mark_flag(model_dir) -> bool:
    """Whether a saved ATSC model was trained with marked aspects (older models: no file -> False)."""
    import json
    from pathlib import Path
    f = Path(model_dir) / "absa_config.json"
    return bool(json.loads(f.read_text())["mark_aspect"]) if f.exists() else False


class ATSCDataset(Dataset):
    def __init__(self, examples: list[dict], tokenizer, max_len: int = config.MAX_LEN):
        self.examples = examples
        self.tok, self.max_len = tokenizer, max_len

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, i):
        ex = self.examples[i]
        enc = self.tok(ex["text"], ex["aspect"], truncation="only_first", max_length=self.max_len)
        return {"input_ids": enc["input_ids"], "token_type_ids": enc["token_type_ids"],
                "attention_mask": enc["attention_mask"], "labels": ex["label"]}


def collate(batch: list[dict], pad_id: int = 0) -> dict[str, torch.Tensor]:
    n = max(len(b["input_ids"]) for b in batch)
    out = {k: torch.zeros((len(batch), n), dtype=torch.long) for k in ("input_ids", "token_type_ids", "attention_mask")}
    out["input_ids"].fill_(pad_id)
    for i, b in enumerate(batch):
        L = len(b["input_ids"])
        for k in ("input_ids", "token_type_ids", "attention_mask"):
            out[k][i, :L] = torch.tensor(b[k])
    out["labels"] = torch.tensor([b["labels"] for b in batch], dtype=torch.long)
    return out


def class_weights(examples: list[dict]) -> torch.Tensor:
    """Inverse-frequency weights, normalized to mean 1: rare classes count more in the loss."""
    counts = Counter(e["label"] for e in examples)
    w = torch.tensor([len(examples) / (len(LABEL2ID) * max(counts.get(i, 1), 1)) for i in range(len(LABEL2ID))])
    return w


@torch.no_grad()
def predict(model, loader, device):
    """Return (gold labels, predicted labels, softmax probabilities)."""
    model.eval()
    gold, pred, probs = [], [], []
    for batch in loader:
        batch = {k: v.to(device) for k, v in batch.items()}
        labels = batch.pop("labels")
        p = torch.softmax(model(**batch).logits, -1)
        gold += labels.cpu().tolist()
        pred += p.argmax(-1).cpu().tolist()
        probs += p.cpu().tolist()
    return gold, pred, probs


def metrics(gold, pred) -> dict:
    p, r, f, _ = precision_recall_fscore_support(gold, pred, labels=list(range(len(LABEL2ID))), zero_division=0)
    present = sorted(set(gold))  # classes that actually occur in this test set
    return {
        "macro_f1_present_classes": float(f1_score(gold, pred, average="macro", labels=present, zero_division=0)),
        "accuracy": float(accuracy_score(gold, pred)),
        "macro_f1": float(f1_score(gold, pred, average="macro", labels=list(range(len(LABEL2ID))), zero_division=0)),
        "per_class": {ID2LABEL[i]: {"precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i])}
                      for i in range(len(LABEL2ID))},
        "confusion_matrix": confusion_matrix(gold, pred, labels=list(range(len(LABEL2ID)))).tolist(),
        "label_order": config.ATSC_LABELS,
    }


def build_model(model_name: str, tokenizer, smoke: bool):
    if smoke:
        cfg = BertConfig(vocab_size=tokenizer.vocab_size, hidden_size=64, num_hidden_layers=2, num_attention_heads=2,
                         intermediate_size=128, num_labels=len(LABEL2ID), id2label=ID2LABEL, label2id=LABEL2ID)
        return BertForSequenceClassification(cfg)
    return AutoModelForSequenceClassification.from_pretrained(
        model_name, num_labels=len(LABEL2ID), id2label=ID2LABEL, label2id=LABEL2ID)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=config.BASE_MODEL)
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--max-len", type=int, default=config.MAX_LEN)
    ap.add_argument("--max-train", type=int, default=None)
    ap.add_argument("--no-class-weights", action="store_true")
    ap.add_argument("--mark-aspect", action="store_true", help="wrap the aspect in << >> inside the sentence")
    ap.add_argument("--out-dir", default=str(config.ATSC_MODEL_DIR))
    ap.add_argument("--data-dir", default=None, help="folder with train.json / val.json (default: data/processed)")
    ap.add_argument("--smoke", action="store_true")
    args = ap.parse_args()

    set_seed()
    device = get_device()
    print(f"Device: {device}")
    tokenizer = get_tokenizer(args.model)
    train_ex = build_examples(load_split("train", args.data_dir), args.mark_aspect)
    val_ex = build_examples(load_split("val", args.data_dir), args.mark_aspect)
    if args.max_train:
        train_ex, val_ex = train_ex[:args.max_train], val_ex[:args.max_train]
    print(f"Train examples: {len(train_ex)} {dict(Counter(ID2LABEL[e['label']] for e in train_ex))} | Val examples: {len(val_ex)}")

    pad = tokenizer.pad_token_id
    train_dl = DataLoader(ATSCDataset(train_ex, tokenizer, args.max_len), batch_size=args.batch_size, shuffle=True,
                          collate_fn=lambda b: collate(b, pad))
    val_dl = DataLoader(ATSCDataset(val_ex, tokenizer, args.max_len), batch_size=32, collate_fn=lambda b: collate(b, pad))

    model = build_model(args.model, tokenizer, args.smoke).to(device)
    weights = None if args.no_class_weights else class_weights(train_ex).to(device)
    print("Class weights:", None if weights is None else {ID2LABEL[i]: round(float(w), 3) for i, w in enumerate(weights)})
    loss_fn = torch.nn.CrossEntropyLoss(weight=weights)

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total = len(train_dl) * args.epochs
    scheduler = get_linear_schedule_with_warmup(optimizer, int(0.1 * total), total)

    history, best = [], -1.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        t0, running = time.time(), 0.0
        for batch in train_dl:
            batch = {k: v.to(device) for k, v in batch.items()}
            labels = batch.pop("labels")
            loss = loss_fn(model(**batch).logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
            running += loss.item()
        gold, pred, _ = predict(model, val_dl, device)
        m = metrics(gold, pred)
        row = {"epoch": epoch, "train_loss": running / len(train_dl), "val_accuracy": m["accuracy"],
               "val_macro_f1": m["macro_f1"], "seconds": round(time.time() - t0, 1)}
        history.append(row)
        print(row)
        if m["macro_f1"] > best:  # select by macro F1, not accuracy (class imbalance)
            best = m["macro_f1"]
            model.save_pretrained(args.out_dir)
            tokenizer.save_pretrained(args.out_dir)
            save_json({"mark_aspect": args.mark_aspect}, f"{args.out_dir}/absa_config.json")

    save_json({
        "task": "ATSC", "base_model": "tiny-random (smoke)" if args.smoke else args.model,
        "input_format": "[CLS] review (aspect marked with << >>) [SEP] aspect [SEP]" if args.mark_aspect else "[CLS] review [SEP] aspect [SEP]",
        "mark_aspect": args.mark_aspect, "epochs": args.epochs, "batch_size": args.batch_size,
        "learning_rate": args.lr, "max_len": args.max_len, "class_weights": weights is not None, "seed": config.SEED,
        "device": str(device), "train_examples": len(train_ex), "val_examples": len(val_ex),
        "best_val_macro_f1": best, "history": history,
    }, f"{args.out_dir}/training_log.json")
    print(f"Saved best model (val macro F1 {best:.4f}) to {args.out_dir}")


if __name__ == "__main__":
    main()
