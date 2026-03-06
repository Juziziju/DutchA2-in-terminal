"""Vocab router — list vocab, trigger Busuu sync, upload CSV."""

import csv
import io
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
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


def _normalize_row(raw_row: dict) -> dict:
    """Map common CSV column name variants to our standard names."""
    # Build a lowercase-key lookup
    lk = {k.lower().strip(): v for k, v in raw_row.items()}
    return {
        "dutch": lk.get("dutch", "") or lk.get("text", "") or lk.get("nl", "") or lk.get("word", ""),
        "english": lk.get("english", "") or lk.get("translation", "") or lk.get("en", "") or lk.get("meaning", ""),
        "category": lk.get("category", "") or lk.get("cat", "") or lk.get("topic", ""),
        "example_dutch": lk.get("example_dutch", "") or lk.get("example", "") or lk.get("example_nl", ""),
        "example_english": lk.get("example_english", "") or lk.get("example_translated", "") or lk.get("example_en", ""),
    }


@router.post("/upload-csv")
def upload_vocab_csv(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    """Upload a CSV file to add new vocab words.

    Accepts columns: dutch/text/nl/word, english/translation/en/meaning,
    category (optional), example_dutch (optional), example_english (optional).
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    raw = file.file.read()
    # Handle BOM and encoding
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            content = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise HTTPException(status_code=400, detail="Cannot decode CSV file")

    reader = csv.DictReader(io.StringIO(content))

    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no header row")

    # Show user what columns were detected
    detected_cols = [c.strip() for c in reader.fieldnames]

    existing_dutch = {v.dutch.lower() for v in session.exec(select(Vocab)).all()}

    added = 0
    skipped = 0
    errors = 0
    for raw_row in reader:
        row = _normalize_row(raw_row)
        dutch = row["dutch"].strip()
        english = row["english"].strip()
        if not dutch or not english:
            skipped += 1
            continue
        if dutch.lower() in existing_dutch:
            skipped += 1
            continue

        audio_file = ""
        try:
            audio_file = ensure_vocab_audio(dutch)
        except Exception:
            errors += 1

        vocab = Vocab(
            dutch=dutch,
            english=english,
            category=row["category"].strip() or "General",
            example_dutch=row["example_dutch"].strip(),
            example_english=row["example_english"].strip(),
            audio_file=audio_file,
        )
        session.add(vocab)
        existing_dutch.add(dutch.lower())
        added += 1

    session.commit()
    return {
        "added": added,
        "skipped": skipped,
        "audio_errors": errors,
        "columns_detected": detected_cols,
    }


def load_vocab_from_db(session: Session) -> list[Vocab]:
    return session.exec(select(Vocab)).all()
