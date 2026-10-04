"""Phase 6: BIO tagging aligned to BERT subword tokens, plus decoding back to aspects.

Encoding:  (text, aspect char spans) -> input_ids, attention_mask, labels
Decoding:  (per-word predicted labels) -> aspect terms with character offsets
"""
from transformers import AutoTokenizer, PreTrainedTokenizerBase

from ml import config

IGNORE = -100  # PyTorch cross-entropy skips this label
LABEL2ID = {l: i for i, l in enumerate(config.ATE_LABELS)}
ID2LABEL = {i: l for l, i in LABEL2ID.items()}


def get_tokenizer(name: str = config.BASE_MODEL) -> PreTrainedTokenizerBase:
    return AutoTokenizer.from_pretrained(name)


def _word_spans(enc) -> dict[int, tuple[int, int, int]]:
    """word_id -> (char_start, char_end, index of its first subword token)."""
    spans: dict[int, list[int]] = {}
    for tok_idx, (wid, (s, e)) in enumerate(zip(enc.word_ids(), enc["offset_mapping"])):
        if wid is None:
            continue
        if wid not in spans:
            spans[wid] = [s, e, tok_idx]
        else:
            spans[wid][0] = min(spans[wid][0], s)
            spans[wid][1] = max(spans[wid][1], e)
    return {w: tuple(v) for w, v in spans.items()}


def encode_with_labels(text: str, aspects: list[dict], tokenizer, max_len: int = config.MAX_LEN) -> dict:
    """Tokenize `text` and produce one BIO label per WORD (on its first subword).

    Steps
      1. Tokenize; the fast tokenizer tells us which word each subword belongs to
         and the character span of each subword.
      2. A word is part of an aspect if its character span overlaps the aspect span.
      3. The first word of an aspect gets B-ASP, following words I-ASP, others O.
      4. Special tokens ([CLS], [SEP]) and continuation subwords (##...) get -100
         so the loss ignores them.
    """
    enc = tokenizer(text, truncation=True, max_length=max_len, return_offsets_mapping=True)
    words = _word_spans(enc)

    word_label = {w: "O" for w in words}
    for a in aspects:
        first = True
        for w in sorted(words):
            ws, we, _ = words[w]
            if ws < a["end"] and we > a["start"]:  # character overlap
                word_label[w] = "B-ASP" if first else "I-ASP"
                first = False

    labels = [IGNORE] * len(enc["input_ids"])
    for w, (_, _, tok_idx) in words.items():
        labels[tok_idx] = LABEL2ID[word_label[w]]

    return {
        "input_ids": enc["input_ids"],
        "attention_mask": enc["attention_mask"],
        "labels": labels,
        "offset_mapping": enc["offset_mapping"],
        "word_ids": enc.word_ids(),
    }


def decode_bio(text: str, offsets, word_ids, labels: list[int]) -> list[dict]:
    """Rebuild aspect terms from per-token labels (IGNORE tokens are skipped).

    A span starts at B-ASP and extends over following I-ASP words. A stray I-ASP
    after an O is treated as the start of a new aspect (lenient decoding).
    """
    words: dict[int, list[int]] = {}
    for tok_idx, wid in enumerate(word_ids):
        if wid is None:
            continue
        s, e = offsets[tok_idx]
        if wid not in words:
            words[wid] = [s, e, tok_idx]
        else:
            words[wid][0] = min(words[wid][0], s)
            words[wid][1] = max(words[wid][1], e)

    aspects, cur = [], None
    for wid in sorted(words):
        ws, we, tok_idx = words[wid]
        label = ID2LABEL.get(labels[tok_idx], "O")
        if label == "B-ASP" or (label == "I-ASP" and cur is None):
            if cur:
                aspects.append(cur)
            cur = {"start": ws, "end": we}
        elif label == "I-ASP":
            cur["end"] = we
        else:
            if cur:
                aspects.append(cur)
            cur = None
    if cur:
        aspects.append(cur)
    for a in aspects:
        a["term"] = text[a["start"]:a["end"]]
    return aspects
