"""KNM router — generate practice questions, submit answers, history."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, func, select

from backend.core.knm_ai import KNM_CATEGORIES, generate_knm_questions
from backend.database import get_session
from backend.models.knm import KNMSession
from backend.models.user import User
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/knm", tags=["knm"])


# ── Categories ───────────────────────────────────────────────────────────────


class CategoryStat(BaseModel):
    category: str
    label_nl: str
    label_en: str
    attempts: int
    avg_score: float | None


@router.get("/categories", response_model=list[CategoryStat])
def get_categories(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # Get per-category stats for this user
    stats_rows = db.exec(
        select(
            KNMSession.category,
            func.count(KNMSession.id),
            func.avg(KNMSession.score_pct),
        )
        .where(KNMSession.user_id == user.id)
        .group_by(KNMSession.category)
    ).all()
    stats_map = {row[0]: (row[1], row[2]) for row in stats_rows}

    result = []
    for key, info in KNM_CATEGORIES.items():
        attempts, avg = stats_map.get(key, (0, None))
        result.append(CategoryStat(
            category=key,
            label_nl=info["label_nl"],
            label_en=info["label_en"],
            attempts=attempts,
            avg_score=round(avg, 1) if avg is not None else None,
        ))
    return result


# ── Generate ─────────────────────────────────────────────────────────────────


class GenerateRequest(BaseModel):
    category: str
    count: int = 5


class GenerateResponse(BaseModel):
    category: str
    questions: list[dict]  # full questions including answer + explanation


@router.post("/generate", response_model=GenerateResponse)
def generate(
    req: GenerateRequest,
    _user: User = Depends(get_current_user),
):
    if req.category not in KNM_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {req.category}")

    count = max(1, min(10, req.count))
    data = generate_knm_questions(req.category, count=count)

    return GenerateResponse(category=req.category, questions=data)


# ── Submit ───────────────────────────────────────────────────────────────────


class SubmitRequest(BaseModel):
    category: str
    questions: list[dict]  # full questions with answers
    user_answers: list[str]


class QuestionResult(BaseModel):
    id: str
    correct: bool
    user_answer: str
    correct_answer: str
    explanation_en: str


class SubmitResponse(BaseModel):
    score: int
    total: int
    score_pct: int
    results: list[QuestionResult]


@router.post("/submit", response_model=SubmitResponse)
def submit(
    req: SubmitRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    questions = req.questions
    user_answers = req.user_answers

    if len(user_answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answer count mismatch.")

    results = []
    correct_count = 0
    for q, ua in zip(questions, user_answers):
        is_correct = ua == q["answer"]
        if is_correct:
            correct_count += 1
        results.append(QuestionResult(
            id=q.get("id", ""),
            correct=is_correct,
            user_answer=ua,
            correct_answer=q["answer"],
            explanation_en=q.get("explanation_en", ""),
        ))

    total = len(questions)
    score_pct = round(correct_count / total * 100) if total else 0

    log_data = {
        "date": datetime.utcnow().isoformat(timespec="seconds"),
        "category": req.category,
        "questions": questions,
        "user_answers": user_answers,
        "score": correct_count,
        "total": total,
        "score_pct": score_pct,
    }

    session = KNMSession(
        user_id=user.id,
        category=req.category,
        score_pct=score_pct,
        total_questions=total,
        correct_count=correct_count,
        log_json=json.dumps(log_data, ensure_ascii=False),
    )
    db.add(session)
    db.commit()

    return SubmitResponse(
        score=correct_count,
        total=total,
        score_pct=score_pct,
        results=results,
    )


# ── History ──────────────────────────────────────────────────────────────────


class HistoryItem(BaseModel):
    id: int
    date: str
    category: str
    score_pct: int
    total_questions: int
    correct_count: int


@router.get("/detail/{session_id}")
def get_detail(
    session_id: int,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    session = db.get(KNMSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    data = json.loads(session.log_json) if session.log_json else {}
    return {
        "id": session.id,
        "date": session.date.isoformat(),
        "category": session.category,
        "score_pct": session.score_pct,
        "total_questions": session.total_questions,
        "correct_count": session.correct_count,
        **data,
    }


@router.get("/history", response_model=list[HistoryItem])
def get_history(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    sessions = db.exec(
        select(KNMSession)
        .where(KNMSession.user_id == user.id)
        .order_by(KNMSession.date.desc())  # type: ignore[union-attr]
        .limit(50)
    ).all()
    return [
        HistoryItem(
            id=s.id,
            date=s.date.isoformat(),
            category=s.category,
            score_pct=s.score_pct,
            total_questions=s.total_questions,
            correct_count=s.correct_count,
        )
        for s in sessions
    ]
