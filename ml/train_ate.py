"""Phase 7: fine-tune BERT for Aspect Term Extraction (token classification, BIO tags).

Run (real training, ideally on a GPU / Colab):
    python -m ml.train_ate
Quick pipeline check on CPU with a tiny random model (no download):
    python -m ml.train_ate --smoke --max-train 64 --epochs 1 --out-dir <folder>
"""
import argparse
import time

import torch
from torch.utils.data import DataLoader, Dataset
from transformers import (AutoModelForTokenClassification, BertConfig, BertForTokenClassification,
                          get_linear_schedule_with_warmup)

from ml import config
from ml.preprocessing.bio import ID2LABEL, IGNORE, LABEL2ID, encode_with_labels, get_tokenizer
from ml.utils import get_device, load_split, save_json, set_seed, span_prf


class ATEDataset(Dataset):
    """One item per sentence: input_ids, attention_mask, BIO labels."""

    def __init__(self, sentences: list[dict], tokenizer, max_len: int = config.MAX_LEN):
        self.items = []
        for s in sentences:
            e = encode_with_labels(s["text"], s["aspects"], tokenizer, max_len)
            self.items.append({k: e[k] for k in ("input_ids", "attention_mask", "labels")})

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        return self.items[i]


def collate(batch: list[dict], pad_id: int = 0) -> dict[str, torch.Tensor]:
    """Pad every sequence in the batch to the longest one."""
    n = max(len(b["input_ids"]) for b in batch)
    ids = torch.full((len(batch), n), pad_id, dtype=torch.long)
    mask = torch.zeros((len(batch), n), dtype=torch.long)
    labels = torch.full((len(batch), n), IGNORE, dtype=torch.long)
    for i, b in enumerate(batch):
        L = len(b["input_ids"])
        ids[i, :L] = torch.tensor(b["input_ids"])
        mask[i, :L] = torch.tensor(b["attention_mask"])
        labels[i, :L] = torch.tensor(b["labels"])
    return {"input_ids": ids, "attention_mask": mask, "labels": labels}


@torch.no_grad()
def evaluate(model, loader, device) -> dict:
    """Validation loss + entity-level (span) precision/recall/F1.

    We count an aspect as correct only if its whole span (B + all I)
    matches exactly. That is the standard ATE metric.
    """
    model.eval()
    total_loss, n_batches = 0.0, 0
    gold, pred = [], []
    for batch in loader:
        batch = {k: v.to(device) for k, v in batch.items()}
        out = model(**batch)
        total_loss += out.loss.item()
        n_batches += 1
        p = out.logits.argmax(-1).cpu().tolist()
        g = batch["labels"].cpu().tolist()
        for pi, gi in zip(p, g):
            keep = [j for j, x in enumerate(gi) if x != IGNORE]  # first subword of each word only
            gold.append([ID2LABEL[gi[j]] for j in keep])
            pred.append([ID2LABEL[pi[j]] for j in keep])
    m = span_prf(gold, pred)
    return {"loss": total_loss / max(n_batches, 1), **m}


def build_model(model_name: str, tokenizer, smoke: bool):
    if smoke:  # tiny random model: proves the pipeline works, learns nothing useful
        cfg = BertConfig(vocab_size=tokenizer.vocab_size, hidden_size=64, num_hidden_layers=2,
                         num_attention_heads=2, intermediate_size=128, num_labels=len(LABEL2ID),
                         id2label=ID2LABEL, label2id=LABEL2ID)
        return BertForTokenClassification(cfg)
    return AutoModelForTokenClassification.from_pretrained(
        model_name, num_labels=len(LABEL2ID), id2label=ID2LABEL, label2id=LABEL2ID)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=config.BASE_MODEL)
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--max-len", type=int, default=config.MAX_LEN)
    ap.add_argument("--max-train", type=int, default=None, help="use only N training sentences (debug)")
    ap.add_argument("--out-dir", default=str(config.ATE_MODEL_DIR))
    ap.add_argument("--data-dir", default=None, help="folder with train.json / val.json (default: data/processed)")
    ap.add_argument("--smoke", action="store_true")
    args = ap.parse_args()

    set_seed()
    device = get_device()
    print(f"Device: {device}")

    tokenizer = get_tokenizer(args.model)
    train_rows, val_rows = load_split("train", args.data_dir), load_split("val", args.data_dir)
    if args.max_train:
        train_rows, val_rows = train_rows[:args.max_train], val_rows[:args.max_train]
    train_ds = ATEDataset(train_rows, tokenizer, args.max_len)
    val_ds = ATEDataset(val_rows, tokenizer, args.max_len)
    pad = tokenizer.pad_token_id
    train_dl = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, collate_fn=lambda b: collate(b, pad))
    val_dl = DataLoader(val_ds, batch_size=32, collate_fn=lambda b: collate(b, pad))
    print(f"Train sentences: {len(train_ds)} | Val sentences: {len(val_ds)}")

    model = build_model(args.model, tokenizer, args.smoke).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total_steps = len(train_dl) * args.epochs
    scheduler = get_linear_schedule_with_warmup(optimizer, int(0.1 * total_steps), total_steps)

    history, best_f1 = [], -1.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        t0, running = time.time(), 0.0
        for batch in train_dl:
            batch = {k: v.to(device) for k, v in batch.items()}
            loss = model(**batch).loss  # cross-entropy, -100 positions ignored
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
            running += loss.item()
        val = evaluate(model, val_dl, device)
        row = {"epoch": epoch, "train_loss": running / len(train_dl), "val_loss": val["loss"],
               "val_precision": val["precision"], "val_recall": val["recall"], "val_f1": val["f1"],
               "seconds": round(time.time() - t0, 1)}
        history.append(row)
        print(row)
        if val["f1"] > best_f1:  # keep the best epoch by validation F1
            best_f1 = val["f1"]
            model.save_pretrained(args.out_dir)
            tokenizer.save_pretrained(args.out_dir)

    save_json({
        "task": "ATE", "base_model": "tiny-random (smoke)" if args.smoke else args.model,
        "epochs": args.epochs, "batch_size": args.batch_size, "learning_rate": args.lr,
        "max_len": args.max_len, "seed": config.SEED, "device": str(device),
        "train_sentences": len(train_ds), "val_sentences": len(val_ds),
        "best_val_f1": best_f1, "history": history,
    }, f"{args.out_dir}/training_log.json")
    print(f"Saved best model (val F1 {best_f1:.4f}) to {args.out_dir}")


if __name__ == "__main__":
    main()
