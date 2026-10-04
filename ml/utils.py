"""Small shared helpers."""
import json
import random
from pathlib import Path

import numpy as np
import torch

from ml import config


def set_seed(seed: int = config.SEED) -> None:
    """Make runs repeatable."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def get_device() -> torch.device:
    """CUDA if available, otherwise CPU."""
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_split(name: str, data_dir: str | Path | None = None) -> list[dict]:
    """Load <data_dir>/<name>.json (default data/processed, the laptop-only split)."""
    path = Path(data_dir or config.PROCESSED_DIR) / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"{path} not found. Run: python -m ml.preprocessing.prepare_data")
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(obj, path: Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(obj, indent=2), encoding="utf-8")


def bio_spans(tags: list[str]) -> set[tuple[int, int]]:
    """Entity spans (start, end_exclusive) from a BIO tag list.

    A span starts at B-ASP (or at an I-ASP that follows O, lenient like seqeval)
    and continues over following I-ASP tags.
    """
    spans, start = set(), None
    for i, t in enumerate(list(tags) + ["O"]):
        if t == "B-ASP" or (t == "I-ASP" and start is None):
            if start is not None:
                spans.add((start, i))
            start = i
        elif t != "I-ASP":
            if start is not None:
                spans.add((start, i))
            start = None
    return spans


def span_prf(gold: list[list[str]], pred: list[list[str]]) -> dict:
    """Exact-match span precision / recall / F1 over many sentences (same result as seqeval)."""
    tp = n_pred = n_gold = 0
    for g, p in zip(gold, pred):
        gs, ps = bio_spans(g), bio_spans(p)
        tp += len(gs & ps)
        n_pred += len(ps)
        n_gold += len(gs)
    prec = tp / n_pred if n_pred else 0.0
    rec = tp / n_gold if n_gold else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return {"precision": prec, "recall": rec, "f1": f1}
