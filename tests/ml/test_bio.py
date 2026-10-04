import json

import pytest

from ml import config
from ml.preprocessing.bio import ID2LABEL, IGNORE, decode_bio, encode_with_labels, get_tokenizer


@pytest.fixture(scope="module")
def tok():
    return get_tokenizer()


def word_labels(text, aspects, tok):
    out = encode_with_labels(text, aspects, tok)
    toks = tok.convert_ids_to_tokens(out["input_ids"])
    return [(t, ID2LABEL[l]) for t, l in zip(toks, out["labels"]) if l != IGNORE]


def test_multiword_aspect_is_b_then_i(tok):
    text = "The battery life is excellent."
    asp = [{"start": 4, "end": 16, "term": "battery life"}]
    assert word_labels(text, asp, tok) == [
        ("the", "O"), ("battery", "B-ASP"), ("life", "I-ASP"), ("is", "O"), ("excellent", "O"), (".", "O")]


def test_no_aspect_is_all_o(tok):
    assert all(l == "O" for _, l in word_labels("I love it.", [], tok))


def test_subword_continuations_are_ignored(tok):
    out = encode_with_labels("The touchpad is unresponsive.", [], tok)
    toks = tok.convert_ids_to_tokens(out["input_ids"])
    for t, l in zip(toks, out["labels"]):
        if t.startswith("##") or t in ("[CLS]", "[SEP]"):
            assert l == IGNORE


def test_two_separate_aspects(tok):
    text = "The screen is great but the battery is poor."
    asp = [{"start": 4, "end": 10, "term": "screen"}, {"start": 29, "end": 36, "term": "battery"}]
    tags = [l for _, l in word_labels(text, asp, tok)]
    assert tags.count("B-ASP") == 2 and tags.count("I-ASP") == 0


def test_decode_roundtrip(tok):
    text = "The battery life is excellent."
    asp = [{"start": 4, "end": 16, "term": "battery life"}]
    out = encode_with_labels(text, asp, tok)
    dec = decode_bio(text, out["offset_mapping"], out["word_ids"], out["labels"])
    assert [d["term"] for d in dec] == ["battery life"]


def test_whole_dataset_roundtrip_is_high():
    """Encoding then decoding gold labels should almost always recover the gold aspects."""
    tok = get_tokenizer()
    ok = total = 0
    for name in ("train", "val", "test"):
        for s in json.load(open(config.PROCESSED_DIR / f"{name}.json", encoding="utf-8")):
            out = encode_with_labels(s["text"], s["aspects"], tok)
            dec = {(d["start"], d["end"]) for d in decode_bio(s["text"], out["offset_mapping"], out["word_ids"], out["labels"])}
            for a in s["aspects"]:
                total += 1
                ok += (a["start"], a["end"]) in dec
    assert ok / total > 0.95, f"only {ok}/{total} aspects survive the BIO round trip"
