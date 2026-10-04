"""Backend API tests. A fake ABSA service is injected so these run without trained models."""
import os
import tempfile

# Must be set before the app is imported so tests never touch the real database.
_tmp = tempfile.mkdtemp()
os.environ["SMARTREVIEW_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.app.main import app  # noqa: E402
from backend.app.models.database import AspectResult, init_db  # noqa: E402
from backend.app.services.absa_service import get_service  # noqa: E402


class FakeService:
    ready = True
    device = "cpu"

    calls = 0

    def analyze_many(self, reviews):
        FakeService.calls += 1
        return [{"review": r, "overall_sentiment": "mixed", "aspects": [
            {"text": "screen", "start": 4, "end": 10, "sentiment": "positive", "confidence": 0.9},
            {"text": "battery", "start": 29, "end": 36, "sentiment": "negative", "confidence": 0.5}]} for r in reviews]

    def analyze(self, review):
        return self.analyze_many([review])[0]


class DownService(FakeService):
    ready = False
    device = "unavailable"


@pytest.fixture(scope="module")
def client():
    init_db()
    app.dependency_overrides[get_service] = lambda: FakeService()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok" and r.json()["models_loaded"] is True


def test_analyze_ok_and_stored(client):
    r = client.post("/api/analyze", json={"review": "The screen is great but the battery is poor."})
    assert r.status_code == 200
    body = r.json()
    assert body["overall_sentiment"] == "mixed" and len(body["aspects"]) == 2
    assert client.get(f"/api/history/{body['id']}").json()["aspects"][0]["text"] == "screen"


@pytest.mark.parametrize("payload", [{"review": ""}, {"review": "   "}, {"review": "x" * 5000}, {}, {"review": 123}, "junk"])
def test_analyze_invalid_requests(client, payload):
    r = client.post("/api/analyze", json=payload)
    assert r.status_code == 422 and "detail" in r.json()
    assert "Traceback" not in r.text


def test_analyze_when_models_missing():
    app.dependency_overrides[get_service] = lambda: DownService()
    r = TestClient(app).post("/api/analyze", json={"review": "Nice laptop."})
    app.dependency_overrides[get_service] = lambda: FakeService()
    assert r.status_code == 503 and "not available" in r.json()["detail"]


def test_history_search_filter_delete(client):
    rid = client.post("/api/analyze", json={"review": "Unique zebra keyword review."}).json()["id"]
    page = client.get("/api/history", params={"search": "zebra"}).json()
    assert page["total"] == 1 and page["items"][0]["id"] == rid
    assert client.get("/api/history", params={"sentiment": "mixed"}).json()["total"] >= 1
    assert client.get("/api/history", params={"sentiment": "bogus"}).status_code == 422
    assert client.delete(f"/api/history/{rid}").status_code == 204
    assert client.get(f"/api/history/{rid}").status_code == 404
    assert client.delete(f"/api/history/{rid}").status_code == 404


def test_analytics(client):
    a = client.get("/api/analytics").json()
    assert a["reviews_analyzed"] >= 1
    assert a["total_aspects"] == a["positive_aspects"] + a["negative_aspects"] + a["neutral_aspects"]
    assert a["top_aspects"][0]["total"] >= 1


def test_model_info_never_fails(client):
    assert client.get("/api/model-info").status_code == 200


# ---------------------------------------------------------------- batch, export, cache, filters
def test_batch_ok_summary_and_saved(client):
    reviews = ["The screen is great but the battery is poor.", "Another screen review with battery notes."]
    r = client.post("/api/analyze/batch", json={"reviews": reviews})
    assert r.status_code == 200
    body = r.json()
    assert len(body["results"]) == 2 and all(x["id"] for x in body["results"])
    sm = body["summary"]
    assert sm["reviews"] == 2 and sm["aspects"] == 4
    assert sm["positive"] == 2 and sm["negative"] == 2
    assert sm["low_confidence"] == 2  # the fake battery confidence is 0.5 (< 0.6)
    assert sm["top_aspects"][0]["total"] == 2


def test_batch_save_false_is_not_stored(client):
    before = client.get("/api/history").json()["total"]
    r = client.post("/api/analyze/batch", json={"reviews": ["A screen and battery review for compare."], "save": False})
    assert r.status_code == 200 and r.json()["results"][0]["id"] is None
    assert client.get("/api/history").json()["total"] == before


@pytest.mark.parametrize("payload", [{"reviews": []}, {"reviews": ["ok", "  "]}, {"reviews": ["x"] * 51},
                                     {"reviews": ["y" * 5000]}, {"reviews": "not a list"}, {}])
def test_batch_invalid(client, payload):
    r = client.post("/api/analyze/batch", json=payload)
    assert r.status_code == 422 and "Traceback" not in r.text


def test_batch_when_models_missing():
    app.dependency_overrides[get_service] = lambda: DownService()
    r = TestClient(app).post("/api/analyze/batch", json={"reviews": ["Nice laptop."]})
    app.dependency_overrides[get_service] = lambda: FakeService()
    assert r.status_code == 503


def test_service_cache_avoids_recomputation():
    from backend.app.services.absa_service import AbsaService

    class P:
        device = "cpu"
        calls = 0

        def analyze_many(self, reviews):
            P.calls += 1
            return [{"review": r, "overall_sentiment": "none", "aspects": []} for r in reviews]

    svc = AbsaService(cache_size=2)
    svc.pipeline = P()
    svc.analyze_many(["one", "two", "one"])          # duplicates inside a batch are computed once
    assert P.calls == 1
    svc.analyze("one")                                 # served from cache
    assert P.calls == 1 and svc.cache_hits >= 1
    svc.analyze_many(["three"])                        # evicts the oldest (cache_size=2)
    svc.analyze("two")
    assert P.calls == 3


def test_export_csv_and_formula_safety(client):
    client.post("/api/analyze", json={"review": "=cmd|' /C calc'!A0 screen battery review"})
    r = client.get("/api/history/export")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    text = r.content.decode("utf-8-sig")
    assert text.splitlines()[0].startswith("review_id,date_utc,overall_sentiment,review,aspect")
    assert "'=cmd" in text and ",=cmd" not in text        # formula cell neutralised
    assert "screen,positive,0.9000" in text


def test_history_aspect_filter(client):
    assert client.get("/api/history", params={"aspect": "battery"}).json()["total"] >= 1
    assert client.get("/api/history", params={"aspect": "zzz-nothing"}).json()["total"] == 0


def test_analytics_has_confidence_fields(client):
    a = client.get("/api/analytics").json()
    assert 0 <= a["avg_confidence"] <= 1 and a["low_confidence_aspects"] >= 1


def test_clear_history(client):
    assert client.delete("/api/history").json()["deleted"] >= 1
    assert client.get("/api/history").json()["total"] == 0
    assert client.get("/api/analytics").json()["reviews_analyzed"] == 0


# ---------------------------------------------------------------- guards and warnings
@pytest.mark.parametrize("review", ["这是一个很好的产品，电池续航很长", "Это отличный телефон, батарея держит долго", "12345 !!!"])
def test_non_english_or_wordless_input_is_rejected_with_a_clear_message(client, review):
    r = client.post("/api/analyze", json={"review": review})
    assert r.status_code == 422
    assert r.json()["detail"] in ("Please write the review in English. This tool only understands English text.",
                                  "The review needs some words to analyze.")
    r2 = client.post("/api/analyze/batch", json={"reviews": ["fine review about the battery", review]})
    assert r2.status_code == 422


def test_off_topic_review_still_analyzed_but_carries_a_warning(client):
    r = client.post("/api/analyze", json={"review": "The shirt fabric is soft but the sleeves are short."})
    assert r.status_code == 200
    assert r.json()["warnings"] and "not tested" in r.json()["warnings"][0]
    ok = client.post("/api/analyze", json={"review": "The battery is great but the screen is dim."}).json()
    assert ok["warnings"] == []


def test_adjusted_flag_is_passed_through_to_the_client():
    class Adj(FakeService):
        def analyze_many(self, reviews):
            return [{"review": r, "overall_sentiment": "neutral", "aspects": [
                {"text": "keyboard", "start": 4, "end": 12, "sentiment": "neutral", "confidence": 0.12,
                 "probabilities": {"negative": 0.03, "neutral": 0.12, "positive": 0.85}, "adjusted": "mild wording (okay)"}]} for r in reviews]

    app.dependency_overrides[get_service] = lambda: Adj()
    body = TestClient(app).post("/api/analyze", json={"review": "The keyboard is okay."}).json()
    app.dependency_overrides[get_service] = lambda: FakeService()
    assert body["aspects"][0]["adjusted"] == "mild wording (okay)"


# ---------------------------------------------------------------- feedback (human-in-the-loop)
def test_saved_aspects_get_a_real_id_unsaved_ones_do_not(client):
    saved = client.post("/api/analyze", json={"review": "The screen is great but the battery is terrible."}).json()
    assert all(isinstance(a["id"], int) for a in saved["aspects"])
    assert all(a["thumbs_up"] == 0 and a["thumbs_down"] == 0 for a in saved["aspects"])

    unsaved = client.post("/api/analyze/batch", json={"reviews": ["Another screen and battery review."], "save": False}).json()
    assert all(a["id"] is None for a in unsaved["results"][0]["aspects"])


def test_feedback_up_and_down_increment_and_are_visible_in_history(client):
    r = client.post("/api/analyze", json={"review": "The screen is crisp but the battery is weak today."}).json()
    aspect_id = r["aspects"][0]["id"]

    up1 = client.post(f"/api/aspects/{aspect_id}/feedback", json={"vote": "up"}).json()
    assert up1 == {"id": aspect_id, "thumbs_up": 1, "thumbs_down": 0}
    up2 = client.post(f"/api/aspects/{aspect_id}/feedback", json={"vote": "up"}).json()
    assert up2["thumbs_up"] == 2
    down = client.post(f"/api/aspects/{aspect_id}/feedback", json={"vote": "down"}).json()
    assert down == {"id": aspect_id, "thumbs_up": 2, "thumbs_down": 1}

    detail = client.get(f"/api/history/{r['id']}").json()
    voted = next(a for a in detail["aspects"] if a["id"] == aspect_id)
    assert voted["thumbs_up"] == 2 and voted["thumbs_down"] == 1


def test_feedback_rejects_unknown_aspect_and_bad_vote(client):
    assert client.post("/api/aspects/999999999/feedback", json={"vote": "up"}).status_code == 404
    r = client.post("/api/analyze", json={"review": "The keyboard is comfortable and quiet."}).json()
    aspect_id = r["aspects"][0]["id"]
    assert client.post(f"/api/aspects/{aspect_id}/feedback", json={"vote": "sideways"}).status_code == 422


def test_feedback_summary_aggregates_and_lists_the_most_disputed(client):
    r = client.post("/api/analyze", json={"review": "The lens is sharp but the grip is loose and the zoom is slow."}).json()
    target = r["aspects"][0]["id"]
    for _ in range(3):
        client.post(f"/api/aspects/{target}/feedback", json={"vote": "down"})
    client.post(f"/api/aspects/{target}/feedback", json={"vote": "up"})

    summary = client.get("/api/feedback/summary").json()
    assert summary["total_votes"] >= 4 and summary["thumbs_down"] >= 3
    assert 0 <= summary["agreement_rate"] <= 1
    assert any(d["aspect_id"] == target and d["thumbs_down"] >= 3 for d in summary["most_disputed"])
    assert summary["most_disputed"] == sorted(summary["most_disputed"], key=lambda d: -d["thumbs_down"])


def test_feedback_summary_with_no_votes_has_no_agreement_rate():
    from backend.app.models.database import SessionLocal as _Session
    db = _Session()
    db.query(AspectResult).update({"thumbs_up": 0, "thumbs_down": 0})
    db.commit()
    db.close()
    summary = TestClient(app).get("/api/feedback/summary").json()
    assert summary == {"total_votes": 0, "thumbs_up": 0, "thumbs_down": 0, "agreement_rate": None, "most_disputed": []}


# ---------------------------------------------------------------- model-info surfaces real result files
def test_model_info_golden_section_is_well_formed_when_present():
    data = TestClient(app).get("/api/model-info").json()
    if "golden" in data:  # only present when docs/results/golden.json exists (python -m ml.eval_golden)
        assert set(data["golden"]["buckets"]) >= {"all", "in_scope", "out_of_scope", "no_aspect"}
        assert isinstance(data["golden"]["still_wrong"], list)
        for row in data["golden"]["still_wrong"]:
            assert row["correct"] < row["of"]
