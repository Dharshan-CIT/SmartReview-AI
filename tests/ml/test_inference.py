"""End-to-end ABSA tests against the REAL trained models (skipped if models are not present).

Tests marked xfail document known model weaknesses honestly rather than hiding them.
"""
import pytest

from ml import config

pytestmark = pytest.mark.skipif(
    not (config.ATE_MODEL_DIR / "config.json").exists() or not (config.ATSC_MODEL_DIR / "config.json").exists(),
    reason="trained models not found in models/ate and models/atsc",
)


@pytest.fixture(scope="module")
def pipe():
    from ml.inference import ABSAPipeline
    return ABSAPipeline()


class TermMap(dict):
    """dict of aspect text -> aspect; a missing key falls back to a substring match, because the
    multi-domain model sometimes extracts 'battery drains' where 'battery' is meant."""

    def __missing__(self, key):
        for k, v in self.items():
            if key in k:
                return v
        raise KeyError(key)


def by_term(result):
    return TermMap({a["text"].lower(): a for a in result["aspects"]})


def test_single_positive(pipe):
    r = pipe.analyze("The display is fantastic.")
    assert by_term(r)["display"]["sentiment"] == "positive"
    assert r["overall_sentiment"] == "positive"


def test_single_negative(pipe):
    r = pipe.analyze("The battery life is terrible.")
    assert by_term(r)["battery life"]["sentiment"] == "negative"


def test_multiple_positive_aspects(pipe):
    r = pipe.analyze("The laptop is lightweight, the keyboard is comfortable, and the display is excellent.")
    t = by_term(r)
    assert t["keyboard"]["sentiment"] == "positive" and t["display"]["sentiment"] == "positive"
    assert all(a["sentiment"] == "positive" for a in r["aspects"])


def test_mixed_review_is_not_collapsed(pipe):
    r = pipe.analyze("The display is beautiful and the keyboard is comfortable, but the battery drains quickly.")
    t = by_term(r)
    assert t["display"]["sentiment"] == "positive"
    assert t["battery"]["sentiment"] == "negative"
    assert r["overall_sentiment"] == "mixed"


def test_contrast_sentence_screen_battery(pipe):
    r = pipe.analyze("The screen is beautiful but the battery drains quickly.")
    t = by_term(r)
    assert t["battery"]["sentiment"] == "negative"
    assert t["screen"]["sentiment"] == "positive"


@pytest.mark.xfail(reason="Known limitation: mild wording like 'okay' is predicted Positive; Neutral is the hardest class "
                          "(smallest class, precision ~0.5 on the laptop test set).", strict=False)
def test_neutral_keyboard_okay(pipe):
    r = pipe.analyze("The keyboard is okay.")
    assert by_term(r)["keyboard"]["sentiment"] == "neutral"


@pytest.mark.parametrize("text", ["I love it.", "Thank you so much!", "I bought it last week."])
def test_no_aspect_handled_gracefully(pipe, text):
    r = pipe.analyze(text)
    assert r["aspects"] == [] and r["overall_sentiment"] == "none"


@pytest.mark.xfail(reason="Known limitation: verbs such as 'recommend' / 'buy' are sometimes extracted as aspects "
                          "(learned from the Hu & Liu annotations).", strict=False)
def test_recommend_is_not_an_aspect(pipe):
    assert pipe.analyze("Highly recommended!")["aspects"] == []


@pytest.mark.parametrize("text,term,expected", [
    ("The camera quality is excellent but the battery performance is disappointing.", "battery", "negative"),
    ("The sound quality is amazing, although the ear cushions are uncomfortable.", "ear cushions", "negative"),
    ("The lens is excellent and the zoom is fast, but the menu system is confusing.", "menu", "negative"),
    ("The ear cushions are comfortable but the bass is weak and the price is too high.", "price", "negative"),
])
def test_other_products_contrast(pipe, text, term, expected):
    """Multi-domain check: phones / cameras / headphones-style reviews, opposite opinions in one sentence."""
    assert by_term(pipe.analyze(text))[term]["sentiment"] == expected


def test_unknown_aspect_does_not_crash(pipe):
    r = pipe.analyze("The Zorblax is great.")
    assert isinstance(r["aspects"], list)


@pytest.mark.parametrize("bad", ["", "   ", "\n\t"])
def test_empty_input_rejected(pipe, bad):
    with pytest.raises(ValueError):
        pipe.analyze(bad)


def test_very_long_input_does_not_crash(pipe):
    r = pipe.analyze("The screen is great. " * 200)
    assert "aspects" in r


def test_outputs_are_well_formed(pipe):
    r = pipe.analyze("The screen is great but the battery is poor.")
    for a in r["aspects"]:
        assert r["review"][a["start"]:a["end"]] == a["text"]
        assert 0.0 <= a["confidence"] <= 1.0
        assert abs(sum(a["probabilities"].values()) - 1.0) < 0.01
        assert a["sentiment"] in {"positive", "negative", "neutral"}


def test_batched_analysis_matches_one_by_one_and_keeps_order(pipe):
    reviews = [
        "The display is fantastic.",
        "The battery life is terrible and the screen is dim.",
        "I love it.",
        "The lens is excellent and the zoom is fast, but the menu system is confusing.",
        "The sound quality is amazing, although the ear cushions are uncomfortable.",
    ]
    key = lambda r: [(a["text"], a["sentiment"], round(a["confidence"], 3)) for a in r["aspects"]]  # noqa: E731
    batched = pipe.analyze_many(reviews)
    assert [b["review"] for b in batched] == reviews          # order preserved despite length sorting
    for review, b in zip(reviews, batched):
        assert key(pipe.analyze(review)) == key(b)


def test_batched_analysis_rejects_empty_review(pipe):
    with pytest.raises(ValueError):
        pipe.analyze_many(["fine review about the screen", "   "])
