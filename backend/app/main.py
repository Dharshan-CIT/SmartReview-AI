"""SmartReview AI API.  Run from the project root:  uvicorn backend.app.main:app --reload"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api import routes_analysis, routes_feedback, routes_health, routes_history
from backend.app.config import ROOT, settings
from backend.app.models.database import init_db
from backend.app.services.absa_service import absa_service

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("smartreview")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    absa_service.load()  # load BERT once at startup
    yield


app = FastAPI(title="SmartReview AI", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])
for router in (routes_health.router, routes_analysis.router, routes_history.router, routes_feedback.router):
    app.include_router(router)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Friendly 422 without echoing internals."""
    msgs = [e["msg"].removeprefix("Value error, ") for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": "; ".join(msgs)})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


# --------------------------------------------------------------------------- serve the built frontend (production)
# In local dev the frontend runs separately on :5173 (Vite, proxying /api to this server), so `frontend/dist`
# won't exist and this block is skipped. In a single-container deploy (see Dockerfile) the frontend is built
# first and this makes the API also serve the UI, so the whole app is one process on one port/origin.
_frontend_dist = ROOT / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=_frontend_dist / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        """Any non-API path serves the SPA shell; React Router handles the actual routing client-side."""
        candidate = _frontend_dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_frontend_dist / "index.html")
