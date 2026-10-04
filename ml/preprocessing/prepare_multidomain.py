"""Build the MULTI-DOMAIN dataset (laptop + phone + cameras/phone/DVD) in the same schema as the laptop data.

    python -m ml.preprocessing.prepare_multidomain

Sources (all in data/raw):
  * SemEval-2014 laptops   -> already split in data/processed/{train,val,test}.json
  * M-ABSA phone (English) -> mabsa_phone/{train,dev,test}.txt   (whole reviews, converted to sentences)
  * Hu & Liu 2004          -> hu_liu/extracted/... (5 products)

Honest design decisions (also written to data/processed_md/build_report.json):
  * Phone: aspects about delivery/logistics/service and the vague 'Overall' category are dropped, because they are not
    product features and would confuse the aspect extractor; only sentences that keep >= 1 aspect are used (the
    original annotation is per review, so an un-annotated sentence may still hide an aspect).
  * Hu & Liu: aspects marked [u]/[p] (absent from sentence), [s] (suggestion) and [cc]/[cs] (comparisons) are dropped;
    the dataset has no 'neutral' polarity.
  * Nikon Coolpix (camera) and Creative Nomad (MP3 player) are kept COMPLETELY UNSEEN: they are only used to test how
    well a model transfers to products it never saw during training.
"""
import ast
import json
import random
import re
from collections import Counter
from pathlib import Path

from ml import config
from ml.preprocessing.prepare_data import clean_sentence
from ml.utils import load_split, save_json

RAW = config.ROOT / "data" / "raw"
OUT = config.ROOT / "data" / "processed_md"
HL_DIR = RAW / "hu_liu" / "extracted" / "customer review data"
SEEN_HL = {"Canon G3.txt": "camera", "Nokia 6610.txt": "phone", "Apex AD2600 Progressive-scan DVD player.txt": "dvd"}
UNSEEN_HL = {"Nikon coolpix 4300.txt": "camera_unseen", "Creative Labs Nomad Jukebox Zen Xtra 40GB.txt": "mp3_unseen"}
DROP_CATEGORIES = ("Logistics", "Service", "Overall", "Customer Service")
MAX_WORDS = 90


def sentence_split(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p]


def locate(sentence: str, term: str, used: set[int]) -> tuple[int, int] | None:
    """First not-yet-used occurrence of `term` in `sentence` (case-insensitive, whole-word if possible)."""
    for pattern in (r"(?<!\w)" + re.escape(term) + r"(?!\w)", re.escape(term)):
        for m in re.finditer(pattern, sentence, flags=re.IGNORECASE):
            if m.start() not in used:
                return m.start(), m.end()
    return None


def build_sentence(sid: str, text: str, raw_aspects: list[tuple[str, str]], domain: str):
    """raw_aspects: [(term, polarity)]. Returns a cleaned sentence dict or None (ok even with zero aspects)."""
    base = clean_sentence({"id": sid, "text": text, "aspects": []})
    if base is None or not (3 <= len(base["text"].split()) <= MAX_WORDS):
        return None
    used: set[int] = set()
    aspects = []
    for term, pol in raw_aspects:
        term = " ".join(term.split())
        if not term or pol not in config.ATSC_LABELS:
            continue
        pos = locate(base["text"], term, used)
        if pos is None:
            continue
        used.add(pos[0])
        aspects.append({"term": base["text"][pos[0]:pos[1]], "polarity": pol, "start": pos[0], "end": pos[1]})
    aspects.sort(key=lambda a: a["start"])
    # remove overlaps (keep the first / longer one)
    clean, last_end = [], -1
    for a in aspects:
        if a["start"] >= last_end:
            clean.append(a)
            last_end = a["end"]
    return {"id": sid, "text": base["text"], "aspects": clean, "domain": domain}


# ------------------------------------------------------------------ M-ABSA phone
def load_mabsa(path: Path, split: str) -> list[dict]:
    rows = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines()):
        if "####" not in line:
            continue
        review, label = line.rsplit("####", 1)
        try:
            triples = ast.literal_eval(label)
        except (ValueError, SyntaxError):
            continue
        seen, wanted = set(), []
        for t in triples:
            if len(t) != 3 or t[1].startswith(DROP_CATEGORIES):
                continue
            key = (t[0].lower(), t[2])
            if key in seen:  # the file repeats identical triples
                continue
            seen.add(key)
            wanted.append((t[0], t[2]))
        for k, sent in enumerate(sentence_split(review)):
            # aspects whose text occurs in this sentence
            here = [(term, pol) for term, pol in wanted if re.search(re.escape(term), sent, flags=re.IGNORECASE)]
            s = build_sentence(f"phone-{split}-{n}-{k}", sent, here, "phone")
            if s and s["aspects"]:  # only sentences that kept >= 1 aspect
                rows.append(s)
    return rows


# ------------------------------------------------------------------ Hu & Liu
def detok(s: str) -> str:
    s = re.sub(r"\s+([,.;:!?%)])", r"\1", s)
    s = re.sub(r"\(\s+", "(", s)
    s = re.sub(r"\s+(n't|'s|'m|'re|'ve|'ll|'d)\b", r"\1", s)
    return s.strip()


def load_hu_liu(path: Path, domain: str) -> list[list[dict]]:
    """Returns a list of REVIEWS, each a list of sentence dicts (so splits can be made per review)."""
    reviews, current = [], []
    for n, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines()):
        line = line.strip()
        if not line or line.startswith("*"):
            continue
        if line.startswith("[t]"):
            if current:
                reviews.append(current)
            current = []
            continue
        if "##" not in line:
            continue
        tags, text = line.split("##", 1)
        text = detok(text)
        raw = []
        for chunk in re.split(r",(?![^\[]*\])", tags):
            m = re.match(r"^(.*?)((?:\[[^\]]*\])+)\s*$", chunk.strip())
            if not m:
                continue
            term, flags = m.group(1).strip(), re.findall(r"\[([^\]]*)\]", m.group(2))
            if any(f in ("u", "p", "s", "cc", "cs") for f in flags):
                continue
            pol = next(("positive" if f.startswith("+") else "negative" for f in flags if f[:1] in "+-" and len(f) > 1), None)
            if term and pol:
                raw.append((term, pol))
        s = build_sentence(f"{domain}-{path.stem}-{n}", text, raw, domain)
        if s and s["aspects"]:
            current.append(s)
    if current:
        reviews.append(current)
    return [r for r in reviews if r]


def stats(rows: list[dict]) -> dict:
    asp = [a for s in rows for a in s["aspects"]]
    return {"sentences": len(rows), "aspects": len(asp), "polarity": dict(Counter(a["polarity"] for a in asp))}


def main() -> None:
    rng = random.Random(config.SEED)
    OUT.mkdir(parents=True, exist_ok=True)
    report: dict = {}

    laptop = {n: [dict(s, domain="laptop") for s in load_split(n)] for n in ("train", "val", "test")}

    phone = {"train": load_mabsa(RAW / "mabsa_phone" / "train.txt", "train"),
             "val": load_mabsa(RAW / "mabsa_phone" / "dev.txt", "val"),
             "test": load_mabsa(RAW / "mabsa_phone" / "test.txt", "test")}

    hl_seen = {"train": [], "val": [], "test": []}
    for fname, dom in SEEN_HL.items():
        revs = load_hu_liu(HL_DIR / fname, dom)
        rng.shuffle(revs)
        n = len(revs)
        cut1, cut2 = int(0.8 * n), int(0.9 * n)
        for name, part in (("train", revs[:cut1]), ("val", revs[cut1:cut2]), ("test", revs[cut2:])):
            hl_seen[name] += [s for r in part for s in r]

    unseen = {dom: [s for r in load_hu_liu(HL_DIR / fname, dom) for s in r] for fname, dom in UNSEEN_HL.items()}

    # Cap the phone training set so one domain does not dominate (fixed seed, documented).
    PHONE_CAP = 1600
    phone_train = phone["train"]
    if len(phone_train) > PHONE_CAP:
        phone_train = rng.sample(phone_train, PHONE_CAP)
    report["phone_train_cap"] = {"available": len(phone["train"]), "used": len(phone_train)}

    merged = {
        "train": laptop["train"] + phone_train + hl_seen["train"],
        "val": laptop["val"] + phone["val"] + hl_seen["val"],
    }
    tests = {"test_laptop": laptop["test"], "test_phone": phone["test"], "test_hl_seen": hl_seen["test"],
             "test_unseen_camera": unseen["camera_unseen"], "test_unseen_mp3": unseen["mp3_unseen"]}

    # LEAKAGE CONTROL: any sentence text that also occurs in a validation/test set is removed from TRAIN
    # (duplicates are common in review corpora), and val is kept disjoint from every test set.
    test_texts = {s["text"].lower() for rows in tests.values() for s in rows}
    val_texts = {s["text"].lower() for s in merged["val"]}
    before = len(merged["train"])
    merged["train"] = [s for s in merged["train"] if s["text"].lower() not in test_texts | val_texts]
    merged["val"] = [s for s in merged["val"] if s["text"].lower() not in test_texts]
    report["train_sentences_removed_for_leakage"] = before - len(merged["train"])
    rng.shuffle(merged["train"])

    for name, rows in {**merged, **tests}.items():
        (OUT / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        report[name] = stats(rows)
        print(f"{name:20s} {report[name]}")

    train_texts = {s["text"].lower() for s in merged["train"]}
    for name, rows in {"val": merged["val"], **tests}.items():
        shared = train_texts & {s["text"].lower() for s in rows}
        assert not shared, f"LEAKAGE between train and {name}: {len(shared)} sentences"
    report["leakage_check"] = "passed: no sentence text shared between train and any validation/test set"
    save_json(report, OUT / "build_report.json")
    print("removed from train for leakage:", report["train_sentences_removed_for_leakage"])
    print(report["leakage_check"])


if __name__ == "__main__":
    main()
