"""FastAPI application entry point."""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import AUDIO_DIR, AUDIO_LISTENING_DIR, AUDIO_SPEAKING_DIR, ROOT_DIR
from backend.database import create_db_and_tables
from backend.models.review_log import FlashcardReviewLog  # noqa: F401 — ensure table is created
from backend.models.user_profile import UserProfile  # noqa: F401
from backend.models.placement import PlacementResult  # noqa: F401
from backend.models.daily_plan import DailyPlan, TaskLog  # noqa: F401
from backend.models.skill_snapshot import SkillSnapshot  # noqa: F401
from backend.models.weekly_report import WeeklyReport, Roadmap  # noqa: F401
from backend.models.speaking import SpeakingSession  # noqa: F401
from backend.models.custom_scene import CustomScene  # noqa: F401
from backend.routers import advisor, auth, exam, flashcards, freestyle, listening, planner, results, speaking, vocab

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
AUDIO_SPEAKING_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")
app.mount(
    "/audio_listening",
    StaticFiles(directory=str(AUDIO_LISTENING_DIR)),
    name="audio_listening",
)
app.mount(
    "/audio_speaking",
    StaticFiles(directory=str(AUDIO_SPEAKING_DIR)),
    name="audio_speaking",
)

# API routers
app.include_router(advisor.router)
app.include_router(auth.router)
app.include_router(vocab.router)
app.include_router(flashcards.router)
app.include_router(listening.router)
app.include_router(exam.router)
app.include_router(results.router)
app.include_router(planner.router)
app.include_router(speaking.router)
app.include_router(freestyle.router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()

    # Cleanup speaking recordings older than 7 days
    from datetime import datetime, timedelta
    from sqlmodel import Session as DBSession, select
    from backend.database import engine
    from backend.models.speaking import SpeakingSession

    cutoff = datetime.utcnow() - timedelta(days=7)
    with DBSession(engine) as db:
        old = db.exec(
            select(SpeakingSession).where(
                SpeakingSession.date < cutoff,
                SpeakingSession.audio_file.is_not(None),  # type: ignore[union-attr]
            )
        ).all()
        if old:
            from backend.core.storage import delete_file
            for s in old:
                if s.audio_file:
                    try:
                        delete_file("speaking", s.audio_file)
                    except Exception:
                        pass
                    local = AUDIO_SPEAKING_DIR / s.audio_file
                    if local.exists():
                        local.unlink()
                    s.audio_file = None
                    db.add(s)
            db.commit()


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
