"""Results router — history, trends, and detail views."""

import json
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, func

from backend.database import get_session
from backend.models.exam import ExamResult
from backend.models.listening import ListeningSession
from backend.models.progress import FlashcardProgress
from backend.models.review_log import FlashcardReviewLog
from backend.models.speaking import SpeakingSession
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
    # Only count cards that have actually been reviewed at least once
    reviewed_rows = [r for r in rows if r.repetitions > 0]
    mastered = sum(1 for r in rows if r.mastered)
    # Due = reviewed but not mastered and next_review <= today
    due_today = sum(1 for r in reviewed_rows if not r.mastered and r.next_review <= today)
    total_vocab = db.exec(select(func.count()).select_from(Vocab)).one()
    return FlashcardStats(
        total_cards=total_vocab,
        mastered=mastered,
        due_today=due_today,
        total_reviewed=len(reviewed_rows),
    )


class ListeningHistoryItem(BaseModel):
    id: int
    date: str
    topic: str
    score_pct: int
    mode: str
    level: str | None
    content_type: str | None
    duration_seconds: int | None


@router.get("/listening", response_model=list[ListeningHistoryItem])
def listening_results(
    mode: str | None = None,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = select(ListeningSession).where(ListeningSession.user_id == user.id)
    if mode:
        stmt = stmt.where(ListeningSession.mode == mode)
    rows = db.exec(stmt.order_by(ListeningSession.date.desc())).all()
    return [
        ListeningHistoryItem(
            id=r.id,
            date=r.date.isoformat(timespec="seconds"),
            topic=r.topic,
            score_pct=r.score_pct,
            mode=r.mode or "quiz",
            level=r.level,
            content_type=r.content_type,
            duration_seconds=r.duration_seconds,
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


# ── Dashboard stats ──────────────────────────────────────────────────────────

class DailyTrainingItem(BaseModel):
    date: str
    mode: str
    count: int
    total_seconds: int
    avg_score: float


class TrainingSummary(BaseModel):
    total_sessions: int
    total_minutes: int
    quiz_sessions: int
    intensive_sessions: int
    avg_score_quiz: float | None
    avg_score_intensive: float | None
    daily: list[DailyTrainingItem]


@router.get("/dashboard/training", response_model=TrainingSummary)
def dashboard_training(
    days: int = 30,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    cutoff = date.today() - timedelta(days=days)
    rows = db.exec(
        select(ListeningSession)
        .where(
            ListeningSession.user_id == user.id,
            ListeningSession.date >= cutoff.isoformat(),
        )
    ).all()

    quiz_rows = [r for r in rows if (r.mode or "quiz") == "quiz"]
    intensive_rows = [r for r in rows if r.mode == "intensive"]

    total_seconds = sum(r.duration_seconds or 0 for r in rows)

    # Group by (date, mode)
    day_mode: dict[tuple[str, str], list] = defaultdict(list)
    for r in rows:
        day = r.date.strftime("%Y-%m-%d") if hasattr(r.date, 'strftime') else str(r.date)[:10]
        mode = r.mode or "quiz"
        day_mode[(day, mode)].append(r)

    daily = []
    for (day, mode), items in sorted(day_mode.items()):
        daily.append(DailyTrainingItem(
            date=day,
            mode=mode,
            count=len(items),
            total_seconds=sum(i.duration_seconds or 0 for i in items),
            avg_score=round(sum(i.score_pct for i in items) / len(items), 1),
        ))

    return TrainingSummary(
        total_sessions=len(rows),
        total_minutes=round(total_seconds / 60),
        quiz_sessions=len(quiz_rows),
        intensive_sessions=len(intensive_rows),
        avg_score_quiz=round(sum(r.score_pct for r in quiz_rows) / len(quiz_rows), 1) if quiz_rows else None,
        avg_score_intensive=round(sum(r.score_pct for r in intensive_rows) / len(intensive_rows), 1) if intensive_rows else None,
        daily=daily,
    )


# ── Streak (all activity) ────────────────────────────────────────────────────


@router.get("/streak")
def get_streak(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Calculate study streak from ALL activity: flashcards, listening, speaking, exams."""
    active_dates: set[str] = set()

    # Flashcard review logs
    fc_logs = db.exec(
        select(FlashcardReviewLog).where(FlashcardReviewLog.user_id == user.id)
    ).all()
    for log in fc_logs:
        d = log.created_at.strftime("%Y-%m-%d") if hasattr(log.created_at, "strftime") else str(log.created_at)[:10]
        active_dates.add(d)

    # Listening sessions
    ls_rows = db.exec(
        select(ListeningSession).where(ListeningSession.user_id == user.id)
    ).all()
    for r in ls_rows:
        d = r.date.strftime("%Y-%m-%d") if hasattr(r.date, "strftime") else str(r.date)[:10]
        active_dates.add(d)

    # Speaking sessions
    sp_rows = db.exec(
        select(SpeakingSession).where(SpeakingSession.user_id == user.id)
    ).all()
    for r in sp_rows:
        d = r.date.strftime("%Y-%m-%d") if hasattr(r.date, "strftime") else str(r.date)[:10]
        active_dates.add(d)

    # Exam results
    ex_rows = db.exec(
        select(ExamResult).where(ExamResult.user_id == user.id)
    ).all()
    for r in ex_rows:
        d = r.date.strftime("%Y-%m-%d") if hasattr(r.date, "strftime") else str(r.date)[:10]
        active_dates.add(d)

    # Calculate streak: count consecutive days backwards from today
    if not active_dates:
        return {"streak": 0, "active_dates": []}

    today = date.today()
    streak = 0
    d = today
    for i in range(365):
        ds = d.isoformat()
        if ds in active_dates:
            streak += 1
        elif i > 0:
            break
        d -= timedelta(days=1)

    return {"streak": streak, "active_dates": sorted(active_dates)[-30:]}


# ── Trend endpoints ──────────────────────────────────────────────────────────

class FlashcardTrendPoint(BaseModel):
    date: str
    reviewed: int
    correct_pct: int


@router.get("/flashcards/trend", response_model=list[FlashcardTrendPoint])
def flashcard_trend(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    cutoff = date.today() - timedelta(days=30)
    logs = db.exec(
        select(FlashcardReviewLog)
        .where(
            FlashcardReviewLog.user_id == user.id,
            FlashcardReviewLog.created_at >= cutoff.isoformat(),
        )
    ).all()

    by_day: dict[str, list[str]] = defaultdict(list)
    for log in logs:
        day = log.created_at.strftime("%Y-%m-%d") if hasattr(log.created_at, 'strftime') else str(log.created_at)[:10]
        by_day[day].append(log.rating)

    result = []
    for day in sorted(by_day):
        ratings = by_day[day]
        correct = sum(1 for r in ratings if r in ("good", "easy", "mastered"))
        result.append(FlashcardTrendPoint(
            date=day,
            reviewed=len(ratings),
            correct_pct=round(correct / len(ratings) * 100) if ratings else 0,
        ))
    return result


class ListeningTrendPoint(BaseModel):
    date: str
    avg_score: float
    count: int


@router.get("/listening/trend", response_model=list[ListeningTrendPoint])
def listening_trend(
    mode: str | None = None,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    cutoff = date.today() - timedelta(days=30)
    stmt = select(ListeningSession).where(
        ListeningSession.user_id == user.id,
        ListeningSession.date >= cutoff.isoformat(),
    )
    if mode:
        stmt = stmt.where(ListeningSession.mode == mode)
    rows = db.exec(stmt).all()

    by_day: dict[str, list[int]] = defaultdict(list)
    for r in rows:
        day = r.date.strftime("%Y-%m-%d") if hasattr(r.date, 'strftime') else str(r.date)[:10]
        by_day[day].append(r.score_pct)

    return [
        ListeningTrendPoint(
            date=day,
            avg_score=round(sum(scores) / len(scores), 1),
            count=len(scores),
        )
        for day, scores in sorted(by_day.items())
    ]


class ExamTrendPoint(BaseModel):
    date: str
    avg_score: float
    count: int


@router.get("/exam/trend", response_model=list[ExamTrendPoint])
def exam_trend(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    cutoff = date.today() - timedelta(days=30)
    rows = db.exec(
        select(ExamResult)
        .where(
            ExamResult.user_id == user.id,
            ExamResult.date >= cutoff.isoformat(),
        )
    ).all()

    by_day: dict[str, list[int]] = defaultdict(list)
    for r in rows:
        day = r.date.strftime("%Y-%m-%d") if hasattr(r.date, 'strftime') else str(r.date)[:10]
        if r.avg_score is not None:
            by_day[day].append(r.avg_score)

    return [
        ExamTrendPoint(
            date=day,
            avg_score=round(sum(scores) / len(scores), 1),
            count=len(scores),
        )
        for day, scores in sorted(by_day.items())
    ]


# ── Detail endpoints ─────────────────────────────────────────────────────────

class ListeningDetail(BaseModel):
    id: int
    date: str
    topic: str
    score_pct: int
    mode: str
    level: str | None
    content_type: str | None
    dialogue: list[dict]
    questions: list[dict]
    vocab_used: list[str]
    # Intensive-specific fields
    lines: list[dict] | None = None
    user_texts: list[str] | None = None
    results: list[dict] | None = None


@router.get("/listening/{session_id}", response_model=ListeningDetail)
def listening_detail(
    session_id: int,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    session = db.get(ListeningSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    log = json.loads(session.log_json) if session.log_json else {}
    return ListeningDetail(
        id=session.id,
        date=session.date.isoformat(timespec="seconds") if hasattr(session.date, 'isoformat') else str(session.date),
        topic=session.topic,
        score_pct=session.score_pct,
        mode=session.mode or "quiz",
        level=session.level,
        content_type=session.content_type,
        dialogue=log.get("dialogue", []),
        questions=log.get("questions", []),
        vocab_used=log.get("vocab_used", []),
        lines=log.get("lines"),
        user_texts=log.get("user_texts"),
        results=log.get("results"),
    )


class FlashcardReviewItem(BaseModel):
    id: int
    date: str
    dutch: str
    english: str
    direction: str
    rating: str


@router.get("/flashcards/history", response_model=list[FlashcardReviewItem])
def flashcard_history(
    limit: int = 50,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    logs = db.exec(
        select(FlashcardReviewLog)
        .where(FlashcardReviewLog.user_id == user.id)
        .order_by(FlashcardReviewLog.created_at.desc())
        .limit(limit)
    ).all()

    vocab_ids = {log.vocab_id for log in logs}
    vocabs = {v.id: v for v in db.exec(select(Vocab).where(Vocab.id.in_(vocab_ids))).all()} if vocab_ids else {}

    return [
        FlashcardReviewItem(
            id=log.id,
            date=log.created_at.isoformat(timespec="seconds") if hasattr(log.created_at, 'isoformat') else str(log.created_at),
            dutch=vocabs[log.vocab_id].dutch if log.vocab_id in vocabs else "?",
            english=vocabs[log.vocab_id].english if log.vocab_id in vocabs else "?",
            direction=log.direction,
            rating=log.rating,
        )
        for log in logs
    ]
