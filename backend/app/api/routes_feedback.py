"""Human-in-the-loop feedback: a 👍/👎 on any stored aspect result.

This is deliberately simple (an anonymous counter, no accounts) but it is a real signal: in a production
system, aspects with many 👎 are exactly the candidates for re-labelling and fine-tuning (see docs/EXPERIMENTS.md,
"future work"). The frontend stops a browser from voting on the same aspect twice (see useVotedAspects), but
nothing here claims this is a secure or statistically rigorous feedback system — it is a demonstration of the idea.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models.database import AspectResult, get_db
from backend.app.models.schemas import DisputedAspect, FeedbackRequest, FeedbackResult, FeedbackSummary

router = APIRouter(prefix="/api", tags=["feedback"])


@router.post("/aspects/{aspect_id}/feedback", response_model=FeedbackResult)
def give_feedback(aspect_id: int, req: FeedbackRequest, db: Session = Depends(get_db)):
    a = db.get(AspectResult, aspect_id)
    if not a:
        raise HTTPException(404, "Aspect not found.")
    if req.vote == "up":
        a.thumbs_up += 1
    else:
        a.thumbs_down += 1
    db.commit()
    return FeedbackResult(id=a.id, thumbs_up=a.thumbs_up, thumbs_down=a.thumbs_down)


@router.get("/feedback/summary", response_model=FeedbackSummary)
def feedback_summary(db: Session = Depends(get_db)):
    """Aggregate feedback plus the aspects with the most disagreement, for the hidden Model page."""
    total_up = db.scalar(select(func.coalesce(func.sum(AspectResult.thumbs_up), 0))) or 0
    total_down = db.scalar(select(func.coalesce(func.sum(AspectResult.thumbs_down), 0))) or 0
    total = total_up + total_down
    disputed = db.scalars(
        select(AspectResult).where(AspectResult.thumbs_down > 0).order_by(AspectResult.thumbs_down.desc(), AspectResult.id.desc()).limit(10)
    ).all()
    return FeedbackSummary(
        total_votes=total, thumbs_up=total_up, thumbs_down=total_down,
        agreement_rate=round(total_up / total, 4) if total else None,
        most_disputed=[DisputedAspect(aspect_id=a.id, review_id=a.review_id, term=a.term, sentiment=a.sentiment,
                                      thumbs_up=a.thumbs_up, thumbs_down=a.thumbs_down) for a in disputed],
    )
