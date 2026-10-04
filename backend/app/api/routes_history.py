import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models.database import AspectResult, Review, get_db
from backend.app.models.schemas import AnalyzeResponse, HistoryPage

router = APIRouter(prefix="/api/history", tags=["history"])
SORTABLE = {"date": Review.created_at, "aspects": Review.n_aspects, "sentiment": Review.overall_sentiment}


def _filtered(search: str | None, sentiment: str | None, aspect: str | None):
    q = select(Review)
    if search:
        q = q.where(Review.text.ilike(f"%{search}%"))
    if sentiment:
        q = q.where(Review.overall_sentiment == sentiment)
    if aspect:  # reviews that mention this aspect (case-insensitive, partial match)
        q = q.where(Review.id.in_(select(AspectResult.review_id).where(func.lower(AspectResult.term).like(f"%{aspect.lower()}%"))))
    return q


@router.get("", response_model=HistoryPage)
def list_history(search: str | None = Query(None, max_length=100),
                 sentiment: Literal["positive", "negative", "neutral", "mixed", "none"] | None = None,
                 aspect: str | None = Query(None, max_length=100),
                 sort: Literal["date", "aspects", "sentiment"] = "date", order: Literal["asc", "desc"] = "desc",
                 limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                 db: Session = Depends(get_db)):
    q = _filtered(search, sentiment, aspect)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    col = SORTABLE[sort]
    q = q.order_by(col.asc() if order == "asc" else col.desc(), Review.id.desc()).limit(limit).offset(offset)
    return {"total": total, "items": db.scalars(q).all()}


def _safe_cell(value: str) -> str:
    """Neutralise spreadsheet formula injection: cells starting with = + - @ are prefixed with a quote."""
    return "'" + value if value[:1] in ("=", "+", "-", "@") else value


@router.get("/export")
def export_history(search: str | None = Query(None, max_length=100),
                   sentiment: Literal["positive", "negative", "neutral", "mixed", "none"] | None = None,
                   aspect: str | None = Query(None, max_length=100),
                   db: Session = Depends(get_db)):
    """Download the (filtered) history as CSV: one row per aspect, so it opens cleanly in Excel."""
    q = _filtered(search, sentiment, aspect).order_by(Review.created_at.desc(), Review.id.desc()).limit(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["review_id", "date_utc", "overall_sentiment", "review", "aspect", "aspect_sentiment", "confidence"])
    for r in db.scalars(q).all():
        stamp = r.created_at.strftime("%Y-%m-%d %H:%M:%S")
        if not r.aspects:
            w.writerow([r.id, stamp, r.overall_sentiment, _safe_cell(r.text), "", "", ""])
        for a in sorted(r.aspects, key=lambda a: a.start):
            w.writerow([r.id, stamp, r.overall_sentiment, _safe_cell(r.text), _safe_cell(a.term), a.sentiment, f"{a.confidence:.4f}"])
    return Response(buf.getvalue().encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="smartreview_history.csv"'})


@router.get("/{review_id}", response_model=AnalyzeResponse)
def get_review(review_id: int, db: Session = Depends(get_db)):
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(404, "Review not found.")
    aspects = [{"id": a.id, "text": a.term, "start": a.start, "end": a.end, "sentiment": a.sentiment, "confidence": a.confidence,
               "thumbs_up": a.thumbs_up, "thumbs_down": a.thumbs_down} for a in sorted(r.aspects, key=lambda a: a.start)]
    return AnalyzeResponse(id=r.id, review=r.text, overall_sentiment=r.overall_sentiment,
                           created_at=r.created_at, aspects=aspects)


@router.delete("/{review_id}", status_code=204)
def delete_review(review_id: int, db: Session = Depends(get_db)):
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(404, "Review not found.")
    db.delete(r)
    db.commit()


@router.delete("", status_code=200)
def clear_history(db: Session = Depends(get_db)):
    """Delete ALL stored analyses (used by the 'Clear history' button, which asks for confirmation)."""
    n = db.query(Review).count()
    db.query(AspectResult).delete()
    db.query(Review).delete()
    db.commit()
    return {"deleted": n}
