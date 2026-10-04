"""Side-by-side predictions of two ATSC models on tricky (contrast) sentences, using the SAME ATE model.

    python -m ml.compare_atsc --a models/atsc --b models/atsc_v2
"""
import argparse
import warnings

warnings.filterwarnings("ignore")

from ml import config  # noqa: E402
from ml.inference import ABSAPipeline  # noqa: E402

CASES = [
    ("The keyboard is okay.", {"keyboard": "neutral"}),
    ("The screen is beautiful but the battery drains quickly.", {"screen": "positive", "battery": "negative"}),
    ("The display is fantastic, the keyboard is comfortable, but the battery life is terrible.",
     {"display": "positive", "keyboard": "positive", "battery life": "negative"}),
    ("The display is beautiful and the keyboard is comfortable, but the battery drains quickly.",
     {"display": "positive", "keyboard": "positive", "battery": "negative"}),
    ("The camera quality is excellent but the battery performance is disappointing.",
     {"camera quality": "positive", "battery performance": "negative"}),
    ("The sound quality is amazing, although the ear cushions are uncomfortable.",
     {"sound quality": "positive", "ear cushions": "negative"}),
    ("The laptop is lightweight, the keyboard is comfortable, and the display is excellent.",
     {"keyboard": "positive", "display": "positive"}),
    ("The battery life is terrible.", {"battery life": "negative"}),
    ("The display is fantastic.", {"display": "positive"}),
]

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", required=True)
    ap.add_argument("--b", required=True)
    ap.add_argument("--ate", default=str(config.ATE_MODEL_DIR))
    args = ap.parse_args()
    pipes = {n: ABSAPipeline(args.ate, d) for n, d in (("A", args.a), ("B", args.b))}
    score = {"A": [0, 0], "B": [0, 0]}
    for text, expected in CASES:
        print(f"\n{text}")
        for name, pipe in pipes.items():
            got = {a["text"].lower(): a for a in pipe.analyze(text)["aspects"]}
            parts = []
            for term, want in expected.items():
                a = got.get(term)
                ok = a is not None and a["sentiment"] == want
                score[name][0] += ok
                score[name][1] += 1
                parts.append(f"{term}: {a['sentiment'] + ' ' + format(a['confidence'], '.2f') if a else 'MISSING'} {'OK' if ok else 'X'}")
            print(f"   {name}: " + " | ".join(parts))
    print("\nexpected-aspect correct:", {k: f"{v[0]}/{v[1]}" for k, v in score.items()})
