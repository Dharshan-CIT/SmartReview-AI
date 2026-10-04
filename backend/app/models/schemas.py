"""Pydantic request/response models (the API contract)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.app.config import settings
from ml.guards import language_error

Sentiment = Literal["positive", "negative", "neutral"]
Overall = Literal["positive", "negative", "neutral", "mixed", "none"]


def _clean_review(v: str) -> str:
    v = " ".join(v.split())
    if not v:
        raise ValueError("Review must not be empty.")
    if len(v) > settings.max_review_chars:
        raise ValueError(f"Review must be at most {settings.max_review_chars} characters.")
    problem = language_error(v)
    if problem:
        raise ValueError(problem)
    return v


class AnalyzeRequest(BaseModel):
    review: str = Field(..., description="Product review text")

    @field_validator("review")
    @classmethod
    def validate_review(cls, v: str) -> str:
        return _clean_review(v)


class BatchRequest(BaseModel):
    reviews: list[str] = Field(..., description="Up to MAX_BATCH reviews")
    save: bool = Field(True, description="Store the analyses in history / analytics")

    @field_validator("reviews")
    @classmethod
    def validate_reviews(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Provide at least one review.")
        if len(v) > settings.max_batch_reviews:
            raise ValueError(f"At most {settings.max_batch_reviews} reviews can be analyzed at once.")
        return [_clean_review(r) for r in v]


class AspectOut(BaseModel):
    id: int | None = None  # the stored aspect's row id; present only when the review was saved to history
    text: str
    start: int
    end: int
    sentiment: Sentiment
    confidence: float
    probabilities: dict[str, float] | None = None
    adjusted: str | None = None  # set only if an (opt-in) rule changed the model's answer
    hint: str | None = None  # informational, e.g. mild wording that could also be read as neutral
    thumbs_up: int = 0
    thumbs_down: int = 0


class AnalyzeResponse(BaseModel):
    id: int | None = None
    review: str
    overall_sentiment: Overall
    aspects: list[AspectOut]
    created_at: datetime
    warnings: list[str] = []


class AspectSummary(BaseModel):
    aspect: str
    total: int
    positive: int
    negative: int
    neutral: int


class BatchSummary(BaseModel):
    reviews: int
    aspects: int
    positive: int
    negative: int
    neutral: int
    avg_confidence: float
    low_confidence: int
    overall_distribution: dict[str, int]
    top_aspects: list[AspectSummary]


class BatchResponse(BaseModel):
    results: list[AnalyzeResponse]
    summary: BatchSummary


class HistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    text: str
    overall_sentiment: Overall
    n_aspects: int
    n_positive: int
    n_negative: int
    n_neutral: int
    created_at: datetime


class HistoryPage(BaseModel):
    total: int
    items: list[HistoryItem]


class FeedbackRequest(BaseModel):
    vote: Literal["up", "down"]


class FeedbackResult(BaseModel):
    id: int
    thumbs_up: int
    thumbs_down: int


class DisputedAspect(BaseModel):
    aspect_id: int
    review_id: int
    term: str
    sentiment: Sentiment
    thumbs_up: int
    thumbs_down: int


class FeedbackSummary(BaseModel):
    total_votes: int
    thumbs_up: int
    thumbs_down: int
    agreement_rate: float | None  # share of votes that were "up"; None until there is at least one vote
    most_disputed: list[DisputedAspect]


class ErrorResponse(BaseModel):
    detail: str
