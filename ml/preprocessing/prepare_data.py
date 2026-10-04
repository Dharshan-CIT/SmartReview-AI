"""Phase 5: load -> validate -> clean -> leak-free split -> save.

Run from the project root:  python -m ml.preprocessing.prepare_data
"""
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter

from sklearn.model_selection import StratifiedGroupKFold

from ml import config


def load_raw(path=config.RAW_FILE) -> list[dict]:
    """Parse the SemEval XML into sentence dicts with character-offset aspects."""
    sentences = []
    for s in ET.parse(path).getroot().iter("sentence"):
        aspects = [
            {"term": a.get("term"), "polarity": a.get("polarity"),
             "start": int(a.get("from")), "end": int(a.get("to"))}
            for a in s.iter("aspectTerm")
        ]
        sentences.append({"id": s.get("id"), "text": s.findtext("text"), "aspects": aspects})
    return sentences


def clean_sentence(sent: dict) -> dict | None:
    """Normalize whitespace and REMAP aspect offsets to the cleaned text.

    Changing the text moves characters around, so offsets must be recomputed or
    the aspects would point at the wrong words. We build an old-index -> new-index
    map while rebuilding the string:
      * non-breaking space (\\xa0) and other whitespace -> one plain space
      * runs of whitespace collapse to a single space
      * leading / trailing whitespace is stripped
    Returns None if the sentence is empty or an aspect no longer matches.
    """
    old = sent["text"]
    new_chars: list[str] = []
    old_to_new: list[int] = []  # index in cleaned text each old char maps to
    for ch in old:
        if ch.isspace():
            if new_chars and new_chars[-1] != " ":
                new_chars.append(" ")
            old_to_new.append(len(new_chars) - 1 if new_chars else 0)
        else:
            new_chars.append(ch)
            old_to_new.append(len(new_chars) - 1)
    new_text = "".join(new_chars).strip()
    lead = len("".join(new_chars)) - len("".join(new_chars).lstrip())
    if not new_text:
        return None

    aspects = []
    for a in sent["aspects"]:
        start = old_to_new[a["start"]] - lead
        end = old_to_new[a["end"] - 1] - lead + 1
        # Some annotations include stray whitespace (e.g. 'uninstall\xa0'): trim the span.
        while start < end and new_text[start] == " ":
            start += 1
        while end > start and new_text[end - 1] == " ":
            end -= 1
        term = new_text[start:end]
        if start < 0 or term != re.sub(r"\s+", " ", a["term"]).strip():
            return None  # unfixable; caller counts and reports it
        aspects.append({"term": term, "polarity": a["polarity"], "start": start, "end": end})
    return {"id": sent["id"], "text": new_text, "aspects": aspects}


def sentence_strata(sent: dict) -> str:
    """One label per sentence used to stratify the split.

    'none' for sentences without aspects, otherwise the sentence's most common
    polarity. This keeps class proportions similar across train/val/test.
    """
    if not sent["aspects"]:
        return "none"
    return Counter(a["polarity"] for a in sent["aspects"]).most_common(1)[0][0]


def grouped_split(sentences: list[dict]) -> dict[str, list[dict]]:
    """80/10/10 split where identical sentence texts always stay together.

    Why grouped: one sentence can carry several aspect annotations (and a few
    sentences are duplicated under different ids). A random split over aspect
    rows would put "battery" in train and "screen" from the SAME sentence in
    test; the model would have seen the sentence already -> inflated scores
    (data leakage). Using the text as the group id makes that impossible.
    """
    groups = [s["text"].lower() for s in sentences]
    strata = [sentence_strata(s) for s in sentences]
    splitter = StratifiedGroupKFold(n_splits=config.N_SPLITS, shuffle=True, random_state=config.SEED)
    folds = [test_idx for _, test_idx in splitter.split(sentences, strata, groups)]
    out = {"test": folds[0], "val": folds[1], "train": [i for f in folds[2:] for i in f]}
    return {name: [sentences[i] for i in sorted(idx)] for name, idx in out.items()}


def summarize(split: list[dict]) -> dict:
    aspects = [a for s in split for a in s["aspects"]]
    atsc = [a for a in aspects if a["polarity"] in config.ATSC_LABELS]
    return {
        "sentences": len(split),
        "sentences_with_aspects": sum(1 for s in split if s["aspects"]),
        "aspect_annotations_all": len(aspects),
        "atsc_examples_no_conflict": len(atsc),
        "polarity_all": dict(Counter(a["polarity"] for a in aspects)),
    }


def main() -> None:
    raw = load_raw()
    cleaned, dropped = [], 0
    for s in raw:
        c = clean_sentence(s)
        if c is None:
            dropped += 1
        else:
            cleaned.append(c)
    print(f"Raw sentences: {len(raw)} | cleaned: {len(cleaned)} | dropped as invalid: {dropped}")

    splits = grouped_split(cleaned)

    # Leakage check: no sentence text may appear in more than one split.
    texts = {name: {s["text"].lower() for s in rows} for name, rows in splits.items()}
    for a, b in [("train", "val"), ("train", "test"), ("val", "test")]:
        overlap = texts[a] & texts[b]
        assert not overlap, f"LEAKAGE between {a} and {b}: {len(overlap)} shared sentences"
    print("Leakage check passed: no sentence text is shared between splits.")

    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    report = {}
    for name, rows in splits.items():
        (config.PROCESSED_DIR / f"{name}.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        report[name] = summarize(rows)
        print(f"{name:5s} {report[name]}")
    (config.PROCESSED_DIR / "split_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    total_atsc = sum(r["atsc_examples_no_conflict"] for r in report.values())
    total_sent_atsc = sum(1 for rows in splits.values() for s in rows
                          if any(a["polarity"] in config.ATSC_LABELS for a in s["aspects"]))
    print(f"\nATSC totals (conflict dropped): {total_atsc} aspects in {total_sent_atsc} sentences")


if __name__ == "__main__":
    main()
