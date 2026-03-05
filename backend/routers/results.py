"""Results router — history for flashcards and exams."""

import json
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.exam import ExamResult
from backend.models.listening import ListeningSession
from backend.models.progress import FlashcardProgress
from backend.models.user import User
from backend.models.vocab import Vocab
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/results", tags=["results"])


class FlashcardStats(BaseModel):
    total_cards: int
    mastered: int
    due_today: int
    total_reviewed: int


@router.get("/flashcards", response_model=FlashcardStats)
def flashcard_results(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    rows = db.exec(
        select(FlashcardProgress).where(FlashcardProgress.user_id == user.id)
    ).all()
    today = date.today()
    mastered = sum(1 for r in rows if r.mastered)
    due_today = sum(1 for r in rows if not r.mastered and r.next_review <= today)
    total_reviewed = sum(1 for r in rows if r.repetitions > 0)
    return FlashcardStats(
        total_cards=len(rows),
        mastered=mastered,
        due_today=due_today,
        total_reviewed=total_reviewed,
    )


class ListeningHistoryItem(BaseModel):
    id: int
    date: str
    topic: str
    score_pct: int


@router.get("/listening", response_model=list[ListeningHistoryItem])
def listening_results(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    rows = db.exec(
        select(ListeningSession)
        .where(ListeningSession.user_id == user.id)
        .order_by(ListeningSession.date.desc())
    ).all()
    return [
        ListeningHistoryItem(
            id=r.id,
            date=r.date.isoformat(timespec="seconds"),
            topic=r.topic,
            score_pct=r.score_pct,
        )
        for r in rows
    ]


class ExamHistoryItem(BaseModel):
    id: int
    date: str
    source: str
    scores: dict
    avg_score: int | None
    passed: bool


@router.get("/exam", response_model=list[ExamHistoryItem])
def exam_results(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    rows = db.exec(
        select(ExamResult)
        .where(ExamResult.user_id == user.id)
        .order_by(ExamResult.date.desc())
    ).all()
    return [
        ExamHistoryItem(
            id=r.id,
            date=r.date.isoformat(timespec="seconds"),
            source=r.source,
            scores=json.loads(r.scores_json),
            avg_score=r.avg_score,
            passed=r.passed,
        )
        for r in rows
    ]
