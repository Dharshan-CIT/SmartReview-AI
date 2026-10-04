"""Build an EVALUATION-ONLY probe set for one question: "if mild wording ('okay', 'average', 'so-so') is
assumed to mean Neutral, does that assumption hold on genuinely unseen mild phrasing?"

    python -m ml.preprocessing.make_synthetic

These sentences are template-generated, clearly synthetic, and used ONLY by `ml.eval_postprocess`
(as `data/processed_md/synthetic_test.json`) — never for training the shipped model, and never
quoted as a real-world accuracy number. The answer this probe gave ("no": real annotators label
"okay" as Positive far more often than Neutral) is exactly why the forced-neutral rule was
rejected; see `ml/experiments/rejected_rules.py` and docs/EXPERIMENTS.md (Experiment 4).

MILD_TRAIN lists the mild words the rule's design already "knew about"; MILD_HELDOUT (used below)
is a disjoint set, so the probe measures generalisation, not memorisation — the assertion at the
bottom of `main()` enforces that the two lists never overlap.
"""
import json
import random

from ml import config

OUT = config.ROOT / "data" / "processed_md"

ASPECTS_TRAIN = [
    "battery life", "screen", "display", "keyboard", "trackpad", "camera", "lens", "zoom", "speaker", "sound quality",
    "price", "storage", "memory", "performance", "software", "design", "weight", "build quality", "charger", "fan",
    "touchscreen", "bass", "microphone", "menu", "resolution", "wifi", "bluetooth", "ports", "case", "interface",
]
ASPECTS_TEST = ["headphones", "cable", "remote", "brightness", "speed", "volume", "grip", "packaging", "buttons", "signal"]

MILD_TRAIN = ["okay", "ok", "alright", "average", "so-so", "acceptable", "adequate", "just okay", "nothing special"]
MILD_HELDOUT = ["fair", "passable", "middling", "mediocre but usable", "not remarkable"]  # never seen in training
POS = ["great", "excellent", "amazing", "fantastic", "superb", "wonderful", "brilliant", "fast", "impressive"]
NEG = ["terrible", "awful", "poor", "disappointing", "horrible", "bad", "useless", "slow", "flimsy"]

SINGLE = ["The {a} is {w}.", "The {a} was {w}.", "I think the {a} is {w}.", "The {a} seems {w}.", "Overall the {a} is {w}."]
DOUBLE = [
    ("The {a1} is {m}, but the {a2} is {n}.", ("neutral", "negative")),
    ("The {a1} is {p} and the {a2} is {m}.", ("positive", "neutral")),
    ("The {a1} is {m} but the {a2} is {p}.", ("neutral", "positive")),
    ("The {a1} is {n}, while the {a2} is {m}.", ("negative", "neutral")),
]


def make(aspects, mild, rng, n_single, n_double):
    rows, seen = [], set()

    def add(text, marks):
        if text in seen:
            return
        seen.add(text)
        aspects_out = []
        for term, pol in marks:
            i = text.lower().find(term.lower())
            aspects_out.append({"term": text[i:i + len(term)], "polarity": pol, "start": i, "end": i + len(term)})
        rows.append({"id": f"syn-{len(rows)}", "text": text, "aspects": aspects_out, "domain": "synthetic"})

    tries = 0
    while len(rows) < n_single and tries < 50000:
        tries += 1
        a = rng.choice(aspects)
        kind = rng.choices(["neutral", "positive", "negative"], weights=[2, 1, 1])[0]
        word = rng.choice({"neutral": mild, "positive": POS, "negative": NEG}[kind])
        add(rng.choice(SINGLE).format(a=a, w=word), [(a, kind)])
    tries = 0
    while len(rows) < n_single + n_double and tries < 50000:
        tries += 1
        a1, a2 = rng.sample(aspects, 2)
        tpl, (p1, p2) = rng.choice(DOUBLE)
        text = tpl.format(a1=a1, a2=a2, m=rng.choice(mild), p=rng.choice(POS), n=rng.choice(NEG))
        add(text, [(a1, p1), (a2, p2)])
    rng.shuffle(rows)
    return rows


def main() -> None:
    assert not set(MILD_TRAIN) & set(MILD_HELDOUT), "MILD_HELDOUT must stay disjoint from MILD_TRAIN, or this is not a held-out probe"
    test = make(ASPECTS_TEST + ASPECTS_TRAIN[:10], MILD_HELDOUT, random.Random(config.SEED + 1), n_single=120, n_double=60)
    (OUT / "synthetic_test.json").write_text(json.dumps(test, indent=1), encoding="utf-8")
    from collections import Counter
    c = Counter(a["polarity"] for s in test for a in s["aspects"])
    print(f"synthetic_test: {len(test)} sentences, aspects by polarity {dict(c)}")


if __name__ == "__main__":
    main()
