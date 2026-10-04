"""Holds the ABSA pipeline as a process-wide singleton so BERT is loaded once, not per request.

Also keeps a small in-memory LRU cache: analyzing the same review twice returns instantly.
"""
import logging
from collections import OrderedDict

from backend.app.config import settings

log = logging.getLogger("smartreview")


class AbsaService:
    def __init__(self, cache_size: int = 512):
        self.pipeline = None
        self.error: str | None = None
        self._cache: OrderedDict[str, dict] = OrderedDict()
        self._cache_size = cache_size
        self.cache_hits = 0

    def load(self) -> None:
        try:
            from ml.inference import ABSAPipeline  # imported lazily: torch is heavy
            self.pipeline = ABSAPipeline(settings.ate_model_dir, settings.atsc_model_dir)
            self.error = None
            self._cache.clear()
            log.info("ABSA models loaded on %s", self.pipeline.device)
            self.pipeline.analyze_many(["The screen is great but the battery is poor."])  # warm-up (not cached)
            log.info("Warm-up done")
        except Exception as exc:  # missing files, corrupt weights, ...
            self.pipeline, self.error = None, str(exc)
            log.error("Model loading failed: %s", exc)

    @property
    def ready(self) -> bool:
        return self.pipeline is not None

    @property
    def device(self) -> str:
        return str(self.pipeline.device) if self.ready else "unavailable"

    def _lookup(self, key: str) -> dict | None:
        """Cache read that also marks the entry as recently used (true LRU)."""
        hit = self._cache.get(key)
        if hit is not None:
            self._cache.move_to_end(key)
        return hit

    def _remember(self, key: str, value: dict) -> None:
        self._cache[key] = value
        self._cache.move_to_end(key)
        while len(self._cache) > self._cache_size:
            self._cache.popitem(last=False)

    def analyze_many(self, reviews: list[str]) -> list[dict]:
        """Batched analysis; reviews already seen are served from the cache."""
        if not self.ready:
            raise RuntimeError("Models are not loaded.")
        results: list[dict | None] = [self._lookup(r) for r in reviews]
        self.cache_hits += sum(r is not None for r in results)
        missing = [i for i, r in enumerate(results) if r is None]
        if missing:
            # de-duplicate inside the batch as well
            unique = list(dict.fromkeys(reviews[i] for i in missing))
            fresh = dict(zip(unique, self.pipeline.analyze_many(unique)))
            for review, res in fresh.items():
                self._remember(review, res)
            for i in missing:
                results[i] = fresh[reviews[i]]
        return [dict(r) for r in results]  # copies: callers must not mutate cached entries

    def analyze(self, review: str) -> dict:
        return self.analyze_many([review])[0]


absa_service = AbsaService()


def get_service() -> AbsaService:
    return absa_service
