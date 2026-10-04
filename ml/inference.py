"""Phase 11: unified ABSA pipeline  (review text -> aspects -> sentiment per aspect).

    from ml.inference import ABSAPipeline
    pipe = ABSAPipeline()            # loads both models ONCE
    pipe.analyze("The screen is great but the battery is poor.")
"""
from pathlib import Path

import torch
from transformers import (AutoModelForSequenceClassification, AutoModelForTokenClassification, AutoTokenizer)

from ml import config
from ml.preprocessing.bio import decode_bio, encode_with_labels
from ml.postprocess import clean_spans, flag_mild_wording
from ml.train_atsc import mark_aspect, read_mark_flag
from ml.utils import get_device


class ModelNotFoundError(RuntimeError):
    """Raised when a trained model folder is missing or incomplete."""


def _check(model_dir: Path, name: str) -> None:
    if not (model_dir / "config.json").exists():
        raise ModelNotFoundError(
            f"{name} model not found in {model_dir}. Train it first "
            f"(python -m ml.train_{name.lower()}) or copy the trained files there.")


def read_temperature(model_dir: Path) -> float:
    """Fitted temperature from absa_config.json (models trained before calibration have none -> 1.0)."""
    import json
    f = Path(model_dir) / "absa_config.json"
    try:
        return float(json.loads(f.read_text()).get("temperature", 1.0)) if f.exists() else 1.0
    except (ValueError, OSError):
        return 1.0


def clean_text(text: str) -> str:
    """Same whitespace normalization used on the training data."""
    return " ".join(text.split())


def overall_sentiment(aspects: list[dict]) -> str:
    """Summarize aspect sentiments: positive / negative / neutral / mixed / none."""
    kinds = {a["sentiment"] for a in aspects}
    if not kinds:
        return "none"
    if {"positive", "negative"} <= kinds:
        return "mixed"
    if "positive" in kinds:
        return "positive"
    if "negative" in kinds:
        return "negative"
    return "neutral"


class ABSAPipeline:
    def __init__(self, ate_dir: Path = config.ATE_MODEL_DIR, atsc_dir: Path = config.ATSC_MODEL_DIR,
                 device: torch.device | None = None, postprocess: bool = True):
        ate_dir, atsc_dir = Path(ate_dir), Path(atsc_dir)
        _check(ate_dir, "ATE")
        _check(atsc_dir, "ATSC")
        self.device = device or get_device()
        self.ate_tok = AutoTokenizer.from_pretrained(ate_dir)
        self.ate = AutoModelForTokenClassification.from_pretrained(ate_dir).to(self.device).eval()
        self.atsc_tok = AutoTokenizer.from_pretrained(atsc_dir)
        self.atsc = AutoModelForSequenceClassification.from_pretrained(atsc_dir).to(self.device).eval()
        self.mark = read_mark_flag(atsc_dir)  # must match how this ATSC model was trained
        self.temperature = read_temperature(atsc_dir)  # confidence calibration (1.0 = uncalibrated)
        self.postprocess = postprocess  # aspect clean-up + mild-wording rule (see ml/postprocess.py)
        self.atsc_labels = [self.atsc.config.id2label[i] for i in range(self.atsc.config.num_labels)]

    @staticmethod
    def _dedupe(spans: list[dict]) -> list[dict]:
        seen, unique = set(), []
        for sp in spans:  # drop exact duplicates
            if (sp["start"], sp["end"]) not in seen:
                seen.add((sp["start"], sp["end"]))
                unique.append(sp)
        return unique

    @torch.no_grad()
    def extract_aspects_many(self, texts: list[str], batch_size: int = 16) -> list[list[dict]]:
        """ATE for many reviews at once. Reviews are sorted by length and padded per batch, which is
        much faster than one forward pass per review, and results are returned in the original order."""
        encs = [encode_with_labels(t, [], self.ate_tok) for t in texts]
        order = sorted(range(len(texts)), key=lambda i: len(encs[i]["input_ids"]))
        results: list[list[dict]] = [[] for _ in texts]
        pad = self.ate_tok.pad_token_id or 0
        for start in range(0, len(order), batch_size):
            idx = order[start:start + batch_size]
            longest = max(len(encs[i]["input_ids"]) for i in idx)
            ids = torch.full((len(idx), longest), pad, dtype=torch.long)
            mask = torch.zeros((len(idx), longest), dtype=torch.long)
            for row, i in enumerate(idx):
                n = len(encs[i]["input_ids"])
                ids[row, :n] = torch.tensor(encs[i]["input_ids"])
                mask[row, :n] = 1
            pred = self.ate(input_ids=ids.to(self.device), attention_mask=mask.to(self.device)).logits.argmax(-1).cpu().tolist()
            for row, i in enumerate(idx):
                e = encs[i]
                n = len(e["input_ids"])
                results[i] = self._dedupe(decode_bio(texts[i], e["offset_mapping"], e["word_ids"], pred[row][:n]))
        return results

    def extract_aspects(self, text: str) -> list[dict]:
        """ATE: token classification -> aspect spans {term, start, end}."""
        return self.extract_aspects_many([text])[0]

    @torch.no_grad()
    def classify_many(self, texts: list[str], aspect_lists: list[list[dict]], batch_size: int = 32) -> list[list[dict]]:
        """ATSC for every (review, aspect) pair across all reviews, in batches."""
        pairs = [(r, a) for r, aspects in enumerate(aspect_lists) for a in aspects]
        out: list[list[dict]] = [[] for _ in texts]
        if not pairs:
            return out
        order = sorted(range(len(pairs)), key=lambda k: len(texts[pairs[k][0]]))
        decided: dict[int, dict] = {}
        for start in range(0, len(order), batch_size):
            idx = order[start:start + batch_size]
            first = [pairs[k][1] for k in idx]
            batch_texts = [mark_aspect(texts[pairs[k][0]], a["start"], a["end"]) if self.mark else texts[pairs[k][0]]
                           for k, a in zip(idx, first)]
            enc = self.atsc_tok(batch_texts, [a["term"] for a in first], truncation="only_first",
                                max_length=config.MAX_LEN, padding=True, return_tensors="pt").to(self.device)
            probs = torch.softmax(self.atsc(**enc).logits / self.temperature, -1).cpu()
            for k, a, p in zip(idx, first, probs):
                j = int(p.argmax())
                decided[k] = {"text": a["term"], "start": a["start"], "end": a["end"],
                              "sentiment": self.atsc_labels[j], "confidence": round(float(p[j]), 4),
                              "probabilities": {l: round(float(p[i]), 4) for i, l in enumerate(self.atsc_labels)}}
        for k, (r, _) in enumerate(pairs):
            out[r].append(decided[k])
        return out

    def classify(self, text: str, aspects: list[dict]) -> list[dict]:
        """ATSC: sentence-pair classification for every aspect of one review."""
        return self.classify_many([text], [aspects])[0]

    def analyze_many(self, reviews: list[str]) -> list[dict]:
        """Analyze many reviews with batched model calls (the fast path used by the batch API)."""
        texts = [clean_text(r) for r in reviews]
        if any(not t for t in texts):
            raise ValueError("Review is empty.")
        spans = self.extract_aspects_many(texts)
        if self.postprocess:
            spans = [clean_spans(t, sp, drop_generic=False) for t, sp in zip(texts, spans)]  # trim only: measured best on validation
        aspect_lists = self.classify_many(texts, spans)
        if self.postprocess:
            aspect_lists = [flag_mild_wording(t, a) for t, a in zip(texts, aspect_lists)]  # informational; never changes the label
        return [{"review": t, "overall_sentiment": overall_sentiment(a), "aspects": a}
                for t, a in zip(texts, aspect_lists)]

    def analyze(self, review: str) -> dict:
        return self.analyze_many([review])[0]
