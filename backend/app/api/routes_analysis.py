import logging
from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models.database import AspectResult, Review, get_db
from backend.app.models.schemas import AnalyzeRequest, AnalyzeResponse, BatchRequest, BatchResponse
from backend.app.services.absa_service import AbsaService, get_service
from ml.guards import scope_warnings

log = logging.getLogger("smartreview")
router = APIRouter(prefix="/api", tags=["analysis"])
LOW_CONFIDENCE = 0.6


def _to_row(result: dict) -> Review:
    aspects = result["aspects"]

    def count(sentiment: str) -> int:
        return sum(a["sentiment"] == sentiment for a in aspects)

    return Review(
        text=result["review"], overall_sentiment=result["overall_sentiment"], n_aspects=len(aspects),
        n_positive=count("positive"), n_negative=count("negative"), n_neutral=count("neutral"),
        aspects=[AspectResult(term=a["text"], start=a["start"], end=a["end"],
                              sentiment=a["sentiment"], confidence=a["confidence"]) for a in aspects])


def _attach_ids(result: dict, review: Review) -> dict:
    """After a commit, copy the DB-assigned aspect ids back onto the plain result dicts (same order as insertion:
    `Review.aspects` is ordered by id, and _to_row built both lists from the same `aspects` list)."""
    for a, row in zip(result["aspects"], review.aspects):
        a["id"] = row.id
    return result


def _run(service: AbsaService, reviews: list[str]) -> list[dict]:
    if not service.ready:
        raise HTTPException(503, "The analysis models are not available right now.")
    try:
        return service.analyze_many(reviews)
    except Exception:
        log.exception("Analysis failed")  # details go to the server log, not to the user
        raise HTTPException(500, "We couldn't analyze this review. Please try again.")


def _summary(results: list[dict]) -> dict:
    aspects = [a for r in results for a in r["aspects"]]
    by = Counter(a["sentiment"] for a in aspects)
    per: dict[str, Counter] = {}
    for a in aspects:
        per.setdefault(a["text"].lower(), Counter())[a["sentiment"]] += 1
    top = sorted(({"aspect": k, "total": sum(v.values()), "positive": v["positive"],
                   "negative": v["negative"], "neutral": v["neutral"]} for k, v in per.items()),
                 key=lambda x: (-x["total"], x["aspect"]))[:12]
    return {
        "reviews": len(results), "aspects": len(aspects),
        "positive": by["positive"], "negative": by["negative"], "neutral": by["neutral"],
        "avg_confidence": round(sum(a["confidence"] for a in aspects) / len(aspects), 4) if aspects else 0.0,
        "low_confidence": sum(a["confidence"] < LOW_CONFIDENCE for a in aspects),
        "overall_distribution": dict(Counter(r["overall_sentiment"] for r in results)),
        "top_aspects": top,
    }


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest, db: Session = Depends(get_db), service: AbsaService = Depends(get_service)):
    result = _run(service, [req.review])[0]
    review = _to_row(result)
    db.add(review)
    db.commit()
    result = _attach_ids(result, review)
    return AnalyzeResponse(id=review.id, review=review.text, overall_sentiment=review.overall_sentiment,
                           aspects=result["aspects"], created_at=review.created_at, warnings=scope_warnings(review.text))


@router.post("/analyze/batch", response_model=BatchResponse)
def analyze_batch(req: BatchRequest, db: Session = Depends(get_db), service: AbsaService = Depends(get_service)):
    """Analyze up to `max_batch_reviews` reviews with batched model calls; optionally store them."""
    results = _run(service, req.reviews)
    rows = [_to_row(r) for r in results] if req.save else []
    if rows:
        db.add_all(rows)
        db.commit()
        results = [_attach_ids(r, row) for r, row in zip(results, rows)]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    out = [AnalyzeResponse(id=rows[i].id if rows else None, review=r["review"], overall_sentiment=r["overall_sentiment"],
                           aspects=r["aspects"], created_at=rows[i].created_at if rows else now, warnings=scope_warnings(r["review"]))
           for i, r in enumerate(results)]
    return BatchResponse(results=out, summary=_summary(results))


@router.get("/analytics")
def analytics(db: Session = Depends(get_db)):
    """Aggregates over all stored analyses."""
    n_reviews = db.scalar(select(func.count(Review.id))) or 0
    by_sent = dict(db.execute(select(AspectResult.sentiment, func.count()).group_by(AspectResult.sentiment)).all())
    overall = dict(db.execute(select(Review.overall_sentiment, func.count()).group_by(Review.overall_sentiment)).all())
    avg_conf = db.scalar(select(func.avg(AspectResult.confidence))) or 0.0
    low_conf = db.scalar(select(func.count()).select_from(AspectResult).where(AspectResult.confidence < LOW_CONFIDENCE)) or 0

    term = func.lower(AspectResult.term)
    rows = db.execute(select(term, AspectResult.sentiment, func.count()).group_by(term, AspectResult.sentiment)).all()
    per_aspect: dict[str, dict[str, int]] = {}
    for name, sent, n in rows:
        d = per_aspect.setdefault(name, {"positive": 0, "negative": 0, "neutral": 0})
        d[sent] = n
    top = sorted(({"aspect": t, "total": sum(d.values()), **d} for t, d in per_aspect.items()),
                 key=lambda x: (-x["total"], x["aspect"]))[:10]

    day = func.date(Review.created_at)
    trend = db.execute(select(day, func.count()).group_by(day).order_by(day)).all()
    return {
        "reviews_analyzed": n_reviews,
        "total_aspects": sum(by_sent.values()),
        "positive_aspects": by_sent.get("positive", 0),
        "negative_aspects": by_sent.get("negative", 0),
        "neutral_aspects": by_sent.get("neutral", 0),
        "avg_confidence": round(float(avg_conf), 4),
        "low_confidence_aspects": low_conf,
        "overall_distribution": overall,
        "top_aspects": top,
        "trend": [{"date": str(d), "reviews": n} for d, n in trend],
    }
