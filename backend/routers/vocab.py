"""Vocab router — list vocab, trigger Busuu sync, upload CSV."""

import csv
import io
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.config import VOCAB_CSV
from backend.core.audio import ensure_vocab_audio
from backend.core.vocab_categories import categorize, categorize_batch_llm
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

        csv_cat = row.get("category", "General").strip() or "General"
        vocab = Vocab(
            dutch=dutch,
            english=english,
            category=categorize(dutch, csv_cat),
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


def _parse_csv_upload(file: UploadFile) -> tuple[csv.DictReader, list[str]]:
    """Parse an uploaded CSV file, return (DictReader, detected_columns)."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    raw = file.file.read()
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

    detected_cols = [c.strip() for c in reader.fieldnames]
    return reader, detected_cols


class PreviewWord(BaseModel):
    dutch: str
    english: str
    category: str
    example_dutch: str = ""
    example_english: str = ""


class PreviewResponse(BaseModel):
    preview: list[PreviewWord]
    skipped: int
    columns_detected: list[str]


class ConfirmRequest(BaseModel):
    words: list[PreviewWord]


class ConfirmResponse(BaseModel):
    added: int
    skipped: int
    audio_errors: int


@router.post("/preview-csv", response_model=PreviewResponse)
def preview_vocab_csv(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    """Parse CSV and return preview of new words (no DB writes)."""
    reader, detected_cols = _parse_csv_upload(file)
    existing_dutch = {v.dutch.lower() for v in session.exec(select(Vocab)).all()}

    preview: list[PreviewWord] = []
    skipped = 0
    for raw_row in reader:
        row = _normalize_row(raw_row)
        dutch = row["dutch"].strip()
        english = row["english"].strip()
        if not dutch or not english or dutch.lower() in existing_dutch:
            skipped += 1
            continue

        csv_cat = row["category"].strip() or "General"
        preview.append(PreviewWord(
            dutch=dutch,
            english=english,
            category=categorize(dutch, csv_cat),
            example_dutch=row["example_dutch"].strip(),
            example_english=row["example_english"].strip(),
        ))
        existing_dutch.add(dutch.lower())  # dedupe within the file

    # Use LLM to categorize words that fell through to "General"
    general_words = [
        {"dutch": w.dutch, "english": w.english}
        for w in preview if w.category == "General"
    ]
    if general_words:
        llm_cats = categorize_batch_llm(general_words)
        for w in preview:
            if w.category == "General" and w.dutch in llm_cats:
                w.category = llm_cats[w.dutch]

    return PreviewResponse(preview=preview, skipped=skipped, columns_detected=detected_cols)


@router.post("/confirm-csv", response_model=ConfirmResponse)
def confirm_vocab_csv(
    body: ConfirmRequest,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    """Insert previewed words into the database."""
    existing_dutch = {v.dutch.lower() for v in session.exec(select(Vocab)).all()}

    added = 0
    skipped = 0
    audio_errors = 0
    for w in body.words:
        dutch = w.dutch.strip()
        english = w.english.strip()
        if not dutch or not english or dutch.lower() in existing_dutch:
            skipped += 1
            continue

        audio_file = ""
        try:
            audio_file = ensure_vocab_audio(dutch)
        except Exception:
            audio_errors += 1

        vocab = Vocab(
            dutch=dutch,
            english=english,
            category=w.category.strip() or "General",
            example_dutch=w.example_dutch.strip(),
            example_english=w.example_english.strip(),
            audio_file=audio_file,
        )
        session.add(vocab)
        existing_dutch.add(dutch.lower())
        added += 1

    session.commit()
    return ConfirmResponse(added=added, skipped=skipped, audio_errors=audio_errors)


@router.post("/upload-csv")
def upload_vocab_csv(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    """Upload a CSV file to add new vocab words (legacy one-step endpoint)."""
    reader, detected_cols = _parse_csv_upload(file)
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

        csv_cat = row["category"].strip() or "General"
        vocab = Vocab(
            dutch=dutch,
            english=english,
            category=categorize(dutch, csv_cat),
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
