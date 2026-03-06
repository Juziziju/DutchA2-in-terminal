"""Flashcards router — SM-2 sessions and reviews."""

import random
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.core.sm2 import QUALITY_MAP, sm2_update
from backend.database import get_session
from backend.models.progress import FlashcardProgress
from backend.models.review_log import FlashcardReviewLog
from backend.models.user import User
from backend.models.vocab import Vocab
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/flashcards", tags=["flashcards"])

MAX_NEW_CARDS = 20


class CardOut(BaseModel):
    progress_id: int  # -1 for new cards (no progress record yet)
    vocab_id: int
    dutch: str
    english: str
    category: str
    example_dutch: str
    example_english: str
    audio_file: str
    direction: str  # "nl_en" | "en_nl"
    is_new: bool


class SessionOut(BaseModel):
    cards: list[CardOut]
    due_count: int
    new_count: int


@router.get("/session", response_model=SessionOut)
def get_session_cards(
    directions: str = "nl_en,en_nl",
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    today = date.today()
    dir_list = [d.strip() for d in directions.split(",") if d.strip() in ("nl_en", "en_nl")]
    if not dir_list:
        dir_list = ["nl_en", "en_nl"]

    all_vocab = db.exec(select(Vocab)).all()

    # Load existing progress for this user
    progress_rows = db.exec(
        select(FlashcardProgress).where(FlashcardProgress.user_id == user.id)
    ).all()
    progress_by_key: dict[tuple[int, str], FlashcardProgress] = {
        (p.vocab_id, p.direction): p for p in progress_rows
    }

    due: list[tuple[Vocab, str, FlashcardProgress]] = []
    new: list[tuple[Vocab, str]] = []

    for vocab in all_vocab:
        for direction in dir_list:
            key = (vocab.id, direction)
            prog = progress_by_key.get(key)
            if prog:
                if prog.mastered:
                    continue
                if prog.repetitions > 0 and prog.next_review <= today:
                    due.append((vocab, direction, prog))
                elif prog.repetitions == 0:
                    # Created but never reviewed — treat as new
                    new.append((vocab, direction))
            else:
                new.append((vocab, direction))

    random.shuffle(due)
    random.shuffle(new)

    # Due cards are top priority — only add new cards if there's room
    MAX_SESSION = 30
    if len(due) >= MAX_SESSION:
        new = []
    else:
        new = new[:min(MAX_NEW_CARDS, MAX_SESSION - len(due))]

    due_count = len(due)
    new_count = len(new)

    cards: list[CardOut] = []
    for vocab, direction, prog in due:
        cards.append(CardOut(
            progress_id=prog.id,
            vocab_id=vocab.id,
            dutch=vocab.dutch,
            english=vocab.english,
            category=vocab.category,
            example_dutch=vocab.example_dutch,
            example_english=vocab.example_english,
            audio_file=vocab.audio_file,
            direction=direction,
            is_new=False,
        ))

    for vocab, direction in new:
        cards.append(CardOut(
            progress_id=-1,  # no progress record yet
            vocab_id=vocab.id,
            dutch=vocab.dutch,
            english=vocab.english,
            category=vocab.category,
            example_dutch=vocab.example_dutch,
            example_english=vocab.example_english,
            audio_file=vocab.audio_file,
            direction=direction,
            is_new=True,
        ))

    return SessionOut(cards=cards, due_count=due_count, new_count=new_count)


class ReviewRequest(BaseModel):
    progress_id: int
    vocab_id: int = -1      # needed when progress_id == -1
    direction: str = ""     # needed when progress_id == -1
    rating: str  # "again" | "hard" | "good" | "easy" | "mastered"


class ReviewOut(BaseModel):
    next_review: str
    interval: int
    ease_factor: float
    mastered: bool


@router.post("/review", response_model=ReviewOut)
def submit_review(
    req: ReviewRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # Resolve or create progress record
    if req.progress_id == -1:
        # New card — create progress on first review
        if req.vocab_id < 0 or not req.direction:
            raise HTTPException(status_code=400, detail="vocab_id and direction required for new cards.")
        prog = db.exec(
            select(FlashcardProgress).where(
                FlashcardProgress.user_id == user.id,
                FlashcardProgress.vocab_id == req.vocab_id,
                FlashcardProgress.direction == req.direction,
            )
        ).first()
        if not prog:
            prog = FlashcardProgress(
                user_id=user.id,
                vocab_id=req.vocab_id,
                direction=req.direction,
            )
            db.add(prog)
            db.commit()
            db.refresh(prog)
    else:
        prog = db.get(FlashcardProgress, req.progress_id)
        if not prog or prog.user_id != user.id:
            raise HTTPException(status_code=404, detail="Progress record not found.")

    # Log this review for trend/history tracking
    db.add(FlashcardReviewLog(
        user_id=user.id,
        vocab_id=prog.vocab_id,
        direction=prog.direction,
        rating=req.rating,
    ))

    if req.rating == "mastered":
        # Mark both directions of this vocab as mastered for this user
        vocab_id = prog.vocab_id
        for direction in ("nl_en", "en_nl"):
            p = db.exec(
                select(FlashcardProgress).where(
                    FlashcardProgress.user_id == user.id,
                    FlashcardProgress.vocab_id == vocab_id,
                    FlashcardProgress.direction == direction,
                )
            ).first()
            if p:
                p.mastered = True
            else:
                p = FlashcardProgress(
                    user_id=user.id,
                    vocab_id=vocab_id,
                    direction=direction,
                    mastered=True,
                )
                db.add(p)
        db.commit()
        db.refresh(prog)
        return ReviewOut(
            next_review=prog.next_review.isoformat(),
            interval=prog.interval,
            ease_factor=prog.ease_factor,
            mastered=True,
        )

    quality = QUALITY_MAP.get(req.rating)
    if quality is None:
        raise HTTPException(status_code=400, detail=f"Unknown rating: {req.rating}")

    state = {
        "interval": prog.interval,
        "ease_factor": prog.ease_factor,
        "repetitions": prog.repetitions,
        "direction": prog.direction,
        "mastered": prog.mastered,
    }
    new_state = sm2_update(state, quality)

    prog.interval = new_state["interval"]
    prog.ease_factor = new_state["ease_factor"]
    prog.repetitions = new_state["repetitions"]
    prog.next_review = date.fromisoformat(new_state["next_review"])
    db.commit()

    return ReviewOut(
        next_review=new_state["next_review"],
        interval=new_state["interval"],
        ease_factor=new_state["ease_factor"],
        mastered=False,
    )


# ── Vocabulary Notebook ─────────────────────────────────────────────────────


class VocabNoteItem(BaseModel):
    vocab_id: int
    dutch: str
    english: str
    category: str
    example_dutch: str
    example_english: str
    audio_file: str
    level: str  # "new" | "learning" | "familiar" | "mastered"
    next_review: Optional[str]
    ease_factor: Optional[float]
    interval: Optional[int]


class VocabNotebookOut(BaseModel):
    items: list[VocabNoteItem]
    counts: dict[str, int]  # level -> count


def _classify_level(prog_nl: Optional[FlashcardProgress], prog_en: Optional[FlashcardProgress]) -> str:
    """Classify a vocab word's memorization level based on best progress across directions."""
    if not prog_nl and not prog_en:
        return "new"
    best = None
    for p in (prog_nl, prog_en):
        if p is None:
            continue
        if p.mastered:
            return "mastered"
        if best is None or p.repetitions > best.repetitions:
            best = p
    if best is None or best.repetitions == 0:
        return "new"
    if best.repetitions <= 2 and best.ease_factor < 2.2:
        return "hard"
    if best.repetitions <= 2:
        return "learning"
    return "familiar"


@router.get("/notebook", response_model=VocabNotebookOut)
def get_vocab_notebook(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return all vocab with per-user memorization levels."""
    all_vocab = db.exec(select(Vocab)).all()
    progress_rows = db.exec(
        select(FlashcardProgress).where(FlashcardProgress.user_id == user.id)
    ).all()
    prog_map: dict[tuple[int, str], FlashcardProgress] = {
        (p.vocab_id, p.direction): p for p in progress_rows
    }

    items: list[VocabNoteItem] = []
    counts: dict[str, int] = {"new": 0, "hard": 0, "learning": 0, "familiar": 0, "mastered": 0}

    for v in all_vocab:
        prog_nl = prog_map.get((v.id, "nl_en"))
        prog_en = prog_map.get((v.id, "en_nl"))
        level = _classify_level(prog_nl, prog_en)
        counts[level] += 1

        # Pick the more advanced progress for display
        best_prog = None
        for p in (prog_nl, prog_en):
            if p and (best_prog is None or p.repetitions > best_prog.repetitions):
                best_prog = p

        items.append(VocabNoteItem(
            vocab_id=v.id,
            dutch=v.dutch,
            english=v.english,
            category=v.category,
            example_dutch=v.example_dutch,
            example_english=v.example_english,
            audio_file=v.audio_file,
            level=level,
            next_review=best_prog.next_review.isoformat() if best_prog and best_prog.repetitions > 0 else None,
            ease_factor=round(best_prog.ease_factor, 2) if best_prog else None,
            interval=best_prog.interval if best_prog else None,
        ))

    return VocabNotebookOut(items=items, counts=counts)
