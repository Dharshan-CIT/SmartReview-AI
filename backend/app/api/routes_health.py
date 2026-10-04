import json

from fastapi import APIRouter, Depends

from backend.app.config import settings
from backend.app.services.absa_service import AbsaService, get_service

router = APIRouter(prefix="/api", tags=["health"])


def _read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


@router.get("/health")
def health(service: AbsaService = Depends(get_service)):
    return {"status": "ok", "models_loaded": service.ready, "device": service.device}


@router.get("/model-info")
def model_info():
    """Real training logs and TEST metrics saved by the training/evaluation scripts (never hard-coded)."""
    out = {}
    for name, d in (("ate", settings.ate_model_dir), ("atsc", settings.atsc_model_dir)):
        out[name] = {"training": _read_json(d / "training_log.json"), "test_metrics": _read_json(d / "test_metrics.json")}
    # Cross-domain comparisons written by `python -m ml.eval_cross_domain` (one JSON per model set).
    out["cross_domain"] = {}
    if settings.results_dir.exists():
        for f in sorted(settings.results_dir.glob("*.json")):
            data = _read_json(f)
            if data:
                # keep the payload small: only the numbers the page shows
                out["cross_domain"][f.stem] = {
                    "name": data.get("name", f.stem),
                    "splits": {k: {"sentences": v["sentences"], "atsc_examples": v["atsc_examples"],
                                   "ate_exact_f1": v["ate_exact"]["f1"], "ate_partial_f1": v["ate_partial"]["f1"],
                                   "atsc_accuracy": v["atsc_accuracy"],
                                   "atsc_macro_f1": v.get("atsc_macro_f1_present_classes", v["atsc_macro_f1"])}
                               for k, v in data.get("splits", {}).items()}}
    # Hand-written golden-review answer check (python -m ml.eval_golden): buckets + the specific cases still wrong.
    golden = _read_json(settings.results_dir / "golden.json")
    if golden:
        on = golden.get("rules_on", {})
        out["golden"] = {
            "buckets": on.get("buckets"),
            "still_wrong": [r for r in on.get("rows", []) if r["correct"] < r["of"]],
        }
    return out
