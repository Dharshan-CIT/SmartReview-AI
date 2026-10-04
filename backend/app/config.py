"""Backend settings, overridable with environment variables (prefix SMARTREVIEW_) or a .env file."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SMARTREVIEW_", env_file=".env", extra="ignore")

    ate_model_dir: Path = ROOT / "models" / "ate"
    atsc_model_dir: Path = ROOT / "models" / "atsc"
    results_dir: Path = ROOT / "docs" / "results"
    database_url: str = f"sqlite:///{(ROOT / 'backend' / 'smartreview.db').as_posix()}"
    max_review_chars: int = 2000
    max_batch_reviews: int = 50
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


settings = Settings()
