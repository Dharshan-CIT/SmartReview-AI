"""Rules that were tried and MEASURED, then NOT shipped. Kept only so the experiment in
docs/EXPERIMENTS.md (Experiment 4) can be reproduced and re-checked — nothing in the live
pipeline (`ml/inference.py`) imports from this file.

`apply_mild_rule` forces mild wording ("okay", "average", "so-so") to Neutral. It looked good on
synthetic sentences generated to encode that exact assumption, but on real annotated reviews human
annotators label "ok"/"okay" as Positive far more often than Neutral, so the rule made ATSC accuracy
WORSE on the held-out test sets (see `python -m ml.eval_postprocess`: fixed 3, broke 14 across the
real test sets). The shipped behaviour instead keeps the model's own label and only adds an
informational `hint` — see `flag_mild_wording` in `ml/postprocess.py`.
"""
from ml.postprocess import mild_wording


def apply_mild_rule(text: str, aspects: list[dict]) -> list[dict]:
    """NOT SHIPPED (see module docstring). Sets sentiment to neutral for aspects whose only opinion is a
    mild word. Flags them with `adjusted` and keeps the model's original label in `model_sentiment`."""
    for a in aspects:
        if a["sentiment"] == "neutral":
            continue
        word = mild_wording(text, a["start"], a["end"])
        if word:
            a["model_sentiment"] = a["sentiment"]
            a["sentiment"] = "neutral"
            a["confidence"] = round(float(a.get("probabilities", {}).get("neutral", a["confidence"])), 4)
            a["adjusted"] = f"mild wording ({word})"
    return aspects
