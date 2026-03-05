"""FastAPI application entry point."""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import AUDIO_DIR, AUDIO_LISTENING_DIR, ROOT_DIR
from backend.database import create_db_and_tables
from backend.models.review_log import FlashcardReviewLog  # noqa: F401 — ensure table is created
from backend.models.user_profile import UserProfile  # noqa: F401
from backend.models.placement import PlacementResult  # noqa: F401
from backend.models.daily_plan import DailyPlan, TaskLog  # noqa: F401
from backend.models.skill_snapshot import SkillSnapshot  # noqa: F401
from backend.models.weekly_report import WeeklyReport, Roadmap  # noqa: F401
from backend.routers import auth, exam, flashcards, listening, planner, results, vocab

app = FastAPI(title="Dutch A2 Blitz", version="1.0.0")

# CORS — only needed for local dev (Vite on :5173 → API on :8000).
# In production, frontend is served from the same origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static audio files
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_LISTENING_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")
app.mount(
    "/audio_listening",
    StaticFiles(directory=str(AUDIO_LISTENING_DIR)),
    name="audio_listening",
)

# API routers
app.include_router(auth.router)
app.include_router(vocab.router)
app.include_router(flashcards.router)
app.include_router(listening.router)
app.include_router(exam.router)
app.include_router(results.router)
app.include_router(planner.router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Serve React frontend (production build) ──────────────────────────────────
# In production, `frontend/dist/` is built by render.yaml buildCommand.
# All non-API routes fall through to index.html for client-side routing.

FRONTEND_DIR = ROOT_DIR / "frontend" / "dist"

if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="frontend_assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # Try to serve a static file first (e.g. favicon.ico, manifest.json)
        file_path = FRONTEND_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        # Otherwise return index.html for React Router
        return FileResponse(FRONTEND_DIR / "index.html")
