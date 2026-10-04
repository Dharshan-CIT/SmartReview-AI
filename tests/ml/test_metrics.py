import random

import pytest

from ml.utils import bio_spans, span_prf


def test_bio_spans_basic():
    assert bio_spans(["O", "B-ASP", "I-ASP", "O", "B-ASP"]) == {(1, 3), (4, 5)}
    assert bio_spans(["B-ASP", "B-ASP"]) == {(0, 1), (1, 2)}
    assert bio_spans(["O", "I-ASP", "I-ASP"]) == {(1, 3)}  # lenient: stray I starts a span
    assert bio_spans([]) == set()


def test_span_prf_exact_and_empty():
    g = [["B-ASP", "I-ASP", "O"], ["O", "O"]]
    assert span_prf(g, g)["f1"] == 1.0
    assert span_prf(g, [["B-ASP", "O", "O"], ["O", "O"]])["f1"] == 0.0  # boundary wrong = no credit
    assert span_prf([["O"]], [["O"]]) == {"precision": 0.0, "recall": 0.0, "f1": 0.0}


def test_matches_seqeval_on_random_sequences():
    seqeval = pytest.importorskip("seqeval.metrics")
    rng = random.Random(0)
    tags = ["O", "B-ASP", "I-ASP"]
    gold = [[rng.choice(tags) for _ in range(rng.randint(1, 12))] for _ in range(2000)]
    pred = [[rng.choice(tags) for _ in g] for g in gold]
    ours = span_prf(gold, pred)
    assert ours["precision"] == pytest.approx(seqeval.precision_score(gold, pred))
    assert ours["recall"] == pytest.approx(seqeval.recall_score(gold, pred))
    assert ours["f1"] == pytest.approx(seqeval.f1_score(gold, pred))
