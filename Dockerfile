# SmartReview AI — single-container deploy (built for Hugging Face Spaces, Docker SDK).
# Multi-stage: build the React frontend, then serve it + the FastAPI API from one Python image.
# The two trained BERT models (models/ate, models/atsc) must be present in the build context —
# they are intentionally NOT in the GitHub repo (see .gitignore); on a Space they are pushed via
# git-lfs directly into this repo's git history.

# ---------- stage 1: build the frontend ----------
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- stage 2: runtime ----------
FROM python:3.13-slim AS runtime
WORKDIR /app

# CPU-only torch (no CUDA) keeps the image small and is all that's needed for inference.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch
COPY requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt

# App code (only what's needed to SERVE, not to train/evaluate)
COPY backend/ backend/
COPY ml/ ml/
COPY docs/results/ docs/results/
COPY models/ models/
COPY --from=frontend-build /app/frontend/dist/ frontend/dist/

# Hugging Face Spaces (Docker SDK) expects the app on port 7860 by default.
ENV SMARTREVIEW_CORS_ORIGINS='[]'
EXPOSE 7860
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
