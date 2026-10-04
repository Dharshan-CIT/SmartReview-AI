"""Score the pipeline on the hand-written golden reviews (tests/golden_reviews.json).

    python -m ml.eval_golden

An expected aspect counts as CORRECT when some extracted aspect contains its key word and has the expected sentiment.
'none' cases are correct when NO aspect is returned. 'contested' cases (mild wording) are reported separately and excluded from 'overall'. Reported for the whole set, and for in-scope vs out-of-scope product types.
Run with the post-processing rules on and off to see what they add. Results go to docs/results/golden.json.
"""
import json
import warnings

warnings.filterwarnings("ignore")

from ml import config  # noqa: E402
from ml.inference import ABSAPipeline  # noqa: E402
from ml.utils import save_json  # noqa: E402

GOLDEN = config.ROOT / "tests" / "golden_reviews.json"


def load_cases():
    return json.loads(GOLDEN.read_text(encoding="utf-8"))["cases"]


def score(pipe: ABSAPipeline, cases) -> dict:
    results = pipe.analyze_many([c["review"] for c in cases])
    rows, buckets = [], {"all": [0, 0], "in_scope": [0, 0], "out_of_scope": [0, 0], "no_aspect": [0, 0], "contested": [0, 0]}
    for c, r in zip(cases, results):
        got = [(a["text"].lower(), a["sentiment"]) for a in r["aspects"]]
        if c["expect"] == "none":
            ok, total, detail = (not got), 1, "no aspect expected"
            buckets["no_aspect"][0] += ok
            buckets["no_aspect"][1] += 1
        else:
            checks = [any(key in term and sent == want for term, sent in got) for key, want in c["expect"].items()]
            ok, total, detail = sum(checks), len(checks), ""
            b = "contested" if c.get("contested") else ("in_scope" if c["in_scope"] else "out_of_scope")
            buckets[b][0] += ok
            buckets[b][1] += total
        if not c.get("contested"):
            buckets["all"][0] += ok
            buckets["all"][1] += total
        rows.append({"review": c["review"], "expected": c["expect"], "got": got, "correct": int(ok), "of": total, "detail": detail})
    return {"buckets": {k: {"correct": v[0], "of": v[1], "rate": round(v[0] / v[1], 4) if v[1] else None} for k, v in buckets.items()}, "rows": rows}


def main() -> None:
    cases = load_cases()
    out = {}
    for label, flag in (("rules_off", False), ("rules_on", True)):
        out[label] = score(ABSAPipeline(postprocess=flag), cases)
        b = out[label]["buckets"]
        print(f"{label:9s}  overall {b['all']['correct']}/{b['all']['of']} ({b['all']['rate']:.1%}) | in-scope aspects {b['in_scope']['correct']}/{b['in_scope']['of']} "
              f"({b['in_scope']['rate']:.1%}) | out-of-scope {b['out_of_scope']['correct']}/{b['out_of_scope']['of']} ({b['out_of_scope']['rate']:.1%}) "
              f"| no-aspect reviews {b['no_aspect']['correct']}/{b['no_aspect']['of']} | contested (mild wording) {b['contested']['correct']}/{b['contested']['of']}")
    print("\nStill wrong with the rules on:")
    for r in out["rules_on"]["rows"]:
        if r["correct"] < r["of"]:
            print(f"  [{r['correct']}/{r['of']}] {r['review']}\n        expected {r['expected']}  got {r['got']}")
    save_json(out, config.ROOT / "docs" / "results" / "golden.json")


if __name__ == "__main__":
    main()
