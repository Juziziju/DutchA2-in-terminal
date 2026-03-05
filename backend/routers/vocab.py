"""Vocab router — list vocab, trigger Busuu sync."""

import csv
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.config import VOCAB_CSV
from backend.core.audio import ensure_vocab_audio
from backend.database import get_session
from backend.models.user import User
from backend.models.vocab import Vocab
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/vocab", tags=["vocab"])


class VocabOut(BaseModel):
    id: int
    dutch: str
    english: str
    category: str
    example_dutch: str
    example_english: str
    audio_file: str


@router.get("", response_model=list[VocabOut])
def list_vocab(
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    return session.exec(select(Vocab)).all()


def _sync_vocab_task(session: Session):
    """Import vocab_input.csv into the Vocab table (insert new, skip existing)."""
    if not VOCAB_CSV.exists():
        return

    with open(VOCAB_CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    existing_dutch = {v.dutch for v in session.exec(select(Vocab)).all()}

    for row in rows:
        dutch = row.get("dutch", "").strip()
        english = row.get("english", "").strip()
        if not dutch or not english or dutch in existing_dutch:
            continue

        audio_file = ""
        try:
            audio_file = ensure_vocab_audio(dutch)
        except Exception:
            pass

        vocab = Vocab(
            dutch=dutch,
            english=english,
            category=row.get("category", "General").strip() or "General",
            example_dutch=row.get("example_dutch", "").strip(),
            example_english=row.get("example_english", "").strip(),
            audio_file=audio_file,
        )
        session.add(vocab)
        existing_dutch.add(dutch)

    session.commit()


@router.post("/sync", status_code=202)
def sync_vocab(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    """Trigger incremental CSV import in the background."""
    background_tasks.add_task(_sync_vocab_task, session)
    return {"detail": "Vocab sync started in background."}


def load_vocab_from_db(session: Session) -> list[Vocab]:
    return session.exec(select(Vocab)).all()
