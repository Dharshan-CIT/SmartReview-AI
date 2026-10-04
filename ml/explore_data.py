"""Phase 4: explore and validate the raw SemEval-2014 Laptops XML.

Prints real statistics computed from the file. Nothing here is hard-coded.
Run from the project root:  python -m ml.explore_data
"""
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

RAW_FILE = Path("data/raw/Laptop_Train_v2.xml")


def load(path: Path = RAW_FILE) -> list[dict]:
    """Parse the XML into a list of {id, text, aspects:[{term, polarity, start, end}]}."""
    sentences = []
    for s in ET.parse(path).getroot().iter("sentence"):
        aspects = [
            {
                "term": a.get("term"),
                "polarity": a.get("polarity"),
                "start": int(a.get("from")),
                "end": int(a.get("to")),
            }
            for a in s.iter("aspectTerm")
        ]
        sentences.append({"id": s.get("id"), "text": s.findtext("text"), "aspects": aspects})
    return sentences


def main() -> None:
    data = load()
    all_aspects = [a for s in data for a in s["aspects"]]
    with_aspects = [s for s in data if s["aspects"]]

    print(f"Total sentences:                 {len(data)}")
    print(f"Sentences with >=1 aspect:       {len(with_aspects)}")
    print(f"Sentences with no aspect:        {len(data) - len(with_aspects)}")
    print(f"Total aspect annotations:        {len(all_aspects)}")
    print(f"Unique sentence ids:             {len({s['id'] for s in data})}")

    pol = Counter(a["polarity"] for a in all_aspects)
    print("\nPolarity distribution (all annotations):")
    for k, v in pol.most_common():
        print(f"  {k:10s} {v:5d}  ({v / len(all_aspects):.1%})")

    # Offset validation: does text[from:to] equal the annotated term?
    bad = [
        (s["id"], a["term"], s["text"][a["start"]:a["end"]])
        for s in data for a in s["aspects"]
        if s["text"][a["start"]:a["end"]] != a["term"]
    ]
    print(f"\nOffset mismatches (text[from:to] != term): {len(bad)}")
    for row in bad[:5]:
        print("  ", row)

    per_sentence = Counter(len(s["aspects"]) for s in with_aspects)
    print("\nAspects per sentence (only sentences with aspects):")
    for k in sorted(per_sentence):
        print(f"  {k}: {per_sentence[k]}")

    lengths = [len(a["term"].split()) for a in all_aspects]
    print("\nAspect length in words:", dict(sorted(Counter(lengths).items())))
    print("Most common aspect terms:", Counter(a["term"].lower() for a in all_aspects).most_common(10))

    mixed = sum(1 for s in with_aspects if len({a["polarity"] for a in s["aspects"]}) > 1)
    print(f"\nSentences with mixed polarities: {mixed}")

    overlaps = 0
    for s in data:
        spans = sorted((a["start"], a["end"]) for a in s["aspects"])
        overlaps += sum(1 for x, y in zip(spans, spans[1:]) if y[0] < x[1])
    print(f"Overlapping aspect spans:        {overlaps}")
    print(f"Duplicate sentence texts:        {len(data) - len({s['text'] for s in data})}")
    print(f"Max sentence length (words):     {max(len(s['text'].split()) for s in data)}")


if __name__ == "__main__":
    main()
