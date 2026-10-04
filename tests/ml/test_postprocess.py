"""Unit tests for the rule layer (no models needed)."""
import pytest

from ml.guards import NON_ENGLISH_MESSAGE, language_error, scope_warnings
from ml.experiments.rejected_rules import apply_mild_rule  # the rejected rule; see its module docstring
from ml.postprocess import clean_spans, flag_mild_wording, mild_wording


def span(text, term):
    i = text.index(term)
    return {"term": term, "start": i, "end": i + len(term)}


# ---------------------------------------------------------------- aspect clean-up
@pytest.mark.parametrize("text,term,expected", [
    ("The battery drains quickly.", "battery drains", "battery"),
    ("The screen is beautiful.", "The screen", "screen"),
    ("My battery life is great.", "My battery life", "battery life"),
    ("The keyboard feels cheap.", "keyboard feels", "keyboard"),
    ("The battery life is terrible.", "battery life", "battery life"),          # unchanged
    ("The sound quality is amazing.", "sound quality", "sound quality"),        # unchanged
])
def test_clean_spans_trims_but_keeps_real_features(text, term, expected):
    out = clean_spans(text, [span(text, term)])
    assert len(out) == 1
    assert out[0]["term"] == expected
    assert text[out[0]["start"]:out[0]["end"]] == expected            # offsets stay true


@pytest.mark.parametrize("text,term", [
    ("Highly recommended!", "recommended"),
    ("Terrible, do not buy.", "do not"),
    ("Terrible, do not buy.", "buy"),
    ("I love it so much.", "love"),
])
def test_clean_spans_drops_non_features(text, term):
    assert clean_spans(text, [span(text, term)]) == []


def test_clean_spans_removes_duplicates_after_trimming():
    text = "The battery drains and the battery dies."
    out = clean_spans(text, [span(text, "battery drains"), span(text, "battery dies")])
    assert [o["term"] for o in out] == ["battery", "battery"]         # two different mentions are kept
    assert out[0]["start"] != out[1]["start"]


# ---------------------------------------------------------------- mild wording
@pytest.mark.parametrize("text,term,mild", [
    ("The keyboard is okay.", "keyboard", "okay"),
    ("The screen is average.", "screen", "average"),
    ("The battery is so-so.", "battery", "so-so"),
    ("The camera is just okay but the battery is terrible.", "camera", "okay"),
    ("The speaker is fair.", "speaker", "fair"),
])
def test_mild_wording_detected(text, term, mild):
    assert mild_wording(text, text.index(term), text.index(term) + len(term)) == mild


@pytest.mark.parametrize("text,term", [
    ("The keyboard is great.", "keyboard"),
    ("The screen is okay and excellent.", "screen"),                      # strong word in the same clause
    ("The screen is really okay and great.", "screen"),
    ("The battery is not okay.", "battery"),                              # negated
    ("The camera is okay but the battery is terrible.", "battery"),       # 'okay' belongs to another clause
    ("The display is excellent.", "display"),
])
def test_mild_wording_not_triggered(text, term):
    assert mild_wording(text, text.index(term), text.index(term) + len(term)) is None


def test_and_before_a_new_subject_splits_the_clause():
    text = "The laptop is okay and the display is excellent."
    assert mild_wording(text, text.index("laptop"), text.index("laptop") + 6) == "okay"
    assert mild_wording(text, text.index("display"), text.index("display") + 7) is None


def test_apply_mild_rule_flags_and_keeps_model_probabilities():
    text = "The keyboard is okay."
    asp = [{"text": "keyboard", "start": 4, "end": 12, "sentiment": "positive", "confidence": 0.85,
            "probabilities": {"negative": 0.03, "neutral": 0.12, "positive": 0.85}}]
    out = apply_mild_rule(text, asp)[0]
    assert out["sentiment"] == "neutral" and out["model_sentiment"] == "positive"
    assert out["probabilities"]["positive"] == 0.85                      # the model's own numbers are untouched
    assert out["confidence"] == 0.12                                     # honest: the model's neutral probability
    assert "mild wording" in out["adjusted"]


def test_apply_mild_rule_leaves_other_aspects_alone():
    text = "The keyboard is okay but the battery is terrible."
    asp = [{"text": "keyboard", "start": 4, "end": 12, "sentiment": "positive", "confidence": 0.8, "probabilities": {"neutral": 0.1}},
           {"text": "battery", "start": 31, "end": 38, "sentiment": "negative", "confidence": 0.99, "probabilities": {"neutral": 0.0}}]
    out = apply_mild_rule(text, asp)
    assert [a["sentiment"] for a in out] == ["neutral", "negative"]
    assert "adjusted" not in out[1]


# ---------------------------------------------------------------- guards
@pytest.mark.parametrize("text", ["这是一个很好的产品，电池续航很长", "Это отличный телефон, батарея держит долго", "बहुत अच्छा फोन है"])
def test_non_english_is_rejected(text):
    assert language_error(text) == NON_ENGLISH_MESSAGE


@pytest.mark.parametrize("text", ["The battery life is great.", "Café-quality sound, très bien battery life", "Screen 10/10!!!"])
def test_english_and_mixed_latin_text_is_accepted(text):
    assert language_error(text) is None


@pytest.mark.parametrize("text", ["12345 !!!", "   ", "😀😀😀"])
def test_text_without_letters_is_rejected(text):
    assert language_error(text)


def test_scope_warning_only_for_clearly_off_topic_reviews():
    assert scope_warnings("The shirt fabric is soft but the sleeves are short.")
    assert scope_warnings("The pizza was delicious and the waiter was kind.")
    assert scope_warnings("The battery lasts long and the camera menu is clear.") == []
    assert scope_warnings("The phone case fabric feels nice.") == []      # electronics word present -> no warning


def test_trim_only_mode_keeps_recommend_and_purchase():
    """Shipped mode: real annotators label 'recommended' / 'purchase' as aspects (17 correct answers were lost by dropping them)."""
    text = "Highly recommended!"
    sp = span(text, "recommended")
    assert clean_spans(text, [sp], drop_generic=False)[0]["term"] == "recommended"
    assert clean_spans(text, [sp], drop_generic=True) == []


def test_flag_mild_wording_adds_a_hint_but_never_changes_the_label():
    text = "The keyboard is okay."
    asp = [{"text": "keyboard", "start": 4, "end": 12, "sentiment": "positive", "confidence": 0.85,
            "probabilities": {"negative": 0.03, "neutral": 0.12, "positive": 0.85}}]
    out = flag_mild_wording(text, asp)[0]
    assert out["sentiment"] == "positive" and out["confidence"] == 0.85
    assert out["hint"] == "mild wording (okay)"
    assert "adjusted" not in out


def test_no_hint_for_clear_opinions():
    text = "The keyboard is excellent."
    asp = [{"text": "keyboard", "start": 4, "end": 12, "sentiment": "positive", "confidence": 0.99}]
    assert "hint" not in flag_mild_wording(text, asp)[0]
