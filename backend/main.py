"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import os

from backend.config import AUDIO_DIR, AUDIO_LISTENING_DIR
from backend.database import create_db_and_tables
from backend.routers import auth, exam, flashcards, listening, results, vocab

app = FastAPI(title="Dutch A2 Blitz", version="1.0.0")

# Allow dev servers + any Vercel deployment URL.
# Set ALLOWED_ORIGINS env var (comma-separated) to add production domains.
_extra = os.environ.get("ALLOWED_ORIGINS", "")
_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
] + [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
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

# Routers
app.include_router(auth.router)
app.include_router(vocab.router)
app.include_router(flashcards.router)
app.include_router(listening.router)
app.include_router(exam.router)
app.include_router(results.router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/health")
def health():
    return {"status": "ok"}
