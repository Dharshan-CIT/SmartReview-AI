"""Answer-quality regression guard: the pipeline must keep getting the hand-written golden reviews right.

Measured when this guard was written: 72/75 overall (96.0%), 45/46 in scope (97.8%), 23/24 out of scope (95.8%), 4/5 no-aspect reviews.
The thresholds sit a little below that, so normal noise passes but a real regression (for example a bad model or rule change) fails.
"""
import pytest

from ml import config

pytestmark = pytest.mark.skipif(
    not (config.ATE_MODEL_DIR / "config.json").exists() or not (config.ATSC_MODEL_DIR / "config.json").exists(),
    reason="trained models not found",
)

MIN_OVERALL = 0.90
MIN_IN_SCOPE = 0.90
MIN_OUT_OF_SCOPE = 0.85
MIN_NO_ASPECT = 3  # of 5


@pytest.fixture(scope="module")
def buckets():
    from ml.eval_golden import load_cases, score
    from ml.inference import ABSAPipeline
    return score(ABSAPipeline(), load_cases())["buckets"]


def test_overall_answer_quality(buckets):
    assert buckets["all"]["rate"] >= MIN_OVERALL, buckets["all"]


def test_in_scope_product_types(buckets):
    assert buckets["in_scope"]["rate"] >= MIN_IN_SCOPE, buckets["in_scope"]


def test_out_of_scope_product_types_do_not_collapse(buckets):
    assert buckets["out_of_scope"]["rate"] >= MIN_OUT_OF_SCOPE, buckets["out_of_scope"]


def test_reviews_without_features_mostly_return_no_aspects(buckets):
    assert buckets["no_aspect"]["correct"] >= MIN_NO_ASPECT, buckets["no_aspect"]


def test_calibration_is_active_and_confidence_is_not_saturated():
    """After temperature scaling, a mildly worded opinion should not be reported with near-100% confidence."""
    from ml.inference import ABSAPipeline
    pipe = ABSAPipeline()
    assert pipe.temperature > 1.0
    a = pipe.analyze("The keyboard is okay.")["aspects"][0]
    assert a["confidence"] < 0.97
    assert a.get("hint", "").startswith("mild wording")          # the mild-wording note is attached
    assert a["sentiment"] == a.get("model_sentiment", a["sentiment"])   # ...and the label is the model's own
