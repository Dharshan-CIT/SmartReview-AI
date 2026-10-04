"""SQLite persistence (SQLAlchemy): one row per analyzed review, one row per detected aspect."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

from backend.app.config import settings

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    overall_sentiment: Mapped[str] = mapped_column(String(16), index=True)
    n_aspects: Mapped[int] = mapped_column(Integer, default=0)
    n_positive: Mapped[int] = mapped_column(Integer, default=0)
    n_negative: Mapped[int] = mapped_column(Integer, default=0)
    n_neutral: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), index=True)
    aspects: Mapped[list["AspectResult"]] = relationship(back_populates="review", cascade="all, delete-orphan", order_by="AspectResult.id")


class AspectResult(Base):
    __tablename__ = "aspects"
    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), index=True)
    term: Mapped[str] = mapped_column(String(200), index=True)
    start: Mapped[int] = mapped_column(Integer)
    end: Mapped[int] = mapped_column(Integer)
    sentiment: Mapped[str] = mapped_column(String(16))
    confidence: Mapped[float] = mapped_column(Float)
    # Lightweight human-in-the-loop signal: a viewer can mark a result as right/wrong (see routes_feedback.py).
    # No accounts, so this is an anonymous counter, not a per-user vote; the frontend prevents double-voting per browser.
    thumbs_up: Mapped[int] = mapped_column(Integer, default=0)
    thumbs_down: Mapped[int] = mapped_column(Integer, default=0)
    review: Mapped[Review] = relationship(back_populates="aspects")


def init_db() -> None:
    Base.metadata.create_all(engine)
    _migrate_add_missing_columns()


def _migrate_add_missing_columns() -> None:
    """Tiny ad-hoc migration: add any model columns that are missing from an existing SQLite file
    (no Alembic for a project this size; `create_all` only creates NEW tables, not new columns)."""
    with engine.begin() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(aspects)")}
        for col, ddl in (("thumbs_up", "INTEGER DEFAULT 0"), ("thumbs_down", "INTEGER DEFAULT 0")):
            if col not in existing:
                conn.exec_driver_sql(f"ALTER TABLE aspects ADD COLUMN {col} {ddl}")


def get_db():
    """FastAPI dependency: one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
