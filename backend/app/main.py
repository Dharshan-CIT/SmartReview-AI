"""SmartReview AI API.  Run from the project root:  uvicorn backend.app.main:app --reload"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api import routes_analysis, routes_feedback, routes_health, routes_history
from backend.app.config import settings
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
