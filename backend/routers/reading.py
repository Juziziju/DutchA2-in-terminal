"""Reading router — generate passages + comprehension questions, submit answers."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.core.reading_ai import READING_TYPE_CONFIGS, generate_reading
from backend.core.qwen import get_explanation
from backend.database import get_session
from backend.models.reading import ReadingSession
from backend.models.user import User
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/reading", tags=["reading"])


# ── Generate ─────────────────────────────────────────────────────────────────


class GenerateRequest(BaseModel):
    content_type: str = "short_text"
    level: str = "A2"
    topic: str = ""


class GenerateResponse(BaseModel):
    content_type: str
    topic: str
    title_nl: str
    passage_nl: str
    passage_en: str
    questions: list[dict]  # full questions including answer + explanation
    level: str
    vocab_used: list[str] = []


@router.post("/generate", response_model=GenerateResponse)
def generate(
    req: GenerateRequest | None = None,
    user: User = Depends(get_current_user),
):
    body = req or GenerateRequest()
    content_type = body.content_type if body.content_type in READING_TYPE_CONFIGS else "short_text"
    level = body.level if body.level in ("A1", "A2", "B1") else "A2"

    data = generate_reading(content_type=content_type, level=level, topic=body.topic)

    return GenerateResponse(
        content_type=data.get("content_type", content_type),
        topic=data["topic"],
        title_nl=data["title_nl"],
        passage_nl=data["passage_nl"],
        passage_en=data["passage_en"],
        questions=data["questions"],
        level=level,
    )


# ── Submit ───────────────────────────────────────────────────────────────────


class SubmitRequest(BaseModel):
    content_type: str
    topic: str
    title_nl: str
    passage_nl: str
    passage_en: str
    questions: list[dict]  # full questions with answers
    user_answers: list[str]
    level: str = "A2"
    duration_seconds: int | None = None


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

    # Save session
    passage_data = {
        "content_type": req.content_type,
        "topic": req.topic,
        "title_nl": req.title_nl,
        "passage_nl": req.passage_nl,
        "passage_en": req.passage_en,
        "questions": req.questions,
        "user_answers": user_answers,
    }
    session = ReadingSession(
        user_id=user.id,
        content_type=req.content_type,
        level=req.level,
        topic=req.topic,
        score_pct=score_pct,
        total_questions=total,
        correct_count=correct_count,
        duration_seconds=req.duration_seconds,
        passage_json=json.dumps(passage_data, ensure_ascii=False),
    )
    db.add(session)
    db.commit()

    return SubmitResponse(
        score=correct_count,
        total=total,
        score_pct=score_pct,
        results=results,
    )


# ── Explain ──────────────────────────────────────────────────────────────────


class ExplainRequest(BaseModel):
    passage_nl: str
    passage_en: str
    questions: list[dict]
    user_answers: list[str]
    level: str = "A2"


@router.post("/explain")
def explain(
    req: ExplainRequest,
    _user: User = Depends(get_current_user),
):
    try:
        # Build a pseudo-dialogue format for get_explanation
        text = get_explanation(
            {"topic": "Reading comprehension", "dialogue": [{"speaker": "Text", "text": req.passage_nl, "english": req.passage_en}]},
            req.questions,
            req.user_answers,
            level=req.level,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"explanation": text}


# ── History ──────────────────────────────────────────────────────────────────


class HistoryItem(BaseModel):
    id: int
    date: str
    content_type: str
    level: str
    topic: str
    score_pct: int
    total_questions: int
    correct_count: int
    duration_seconds: int | None


@router.get("/detail/{session_id}")
def get_detail(
    session_id: int,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    session = db.get(ReadingSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    data = json.loads(session.passage_json) if session.passage_json else {}
    return {
        "id": session.id,
        "date": session.date.isoformat(),
        "content_type": session.content_type,
        "level": session.level,
        "topic": session.topic,
        "score_pct": session.score_pct,
        "total_questions": session.total_questions,
        "correct_count": session.correct_count,
        "duration_seconds": session.duration_seconds,
        **data,
    }


@router.get("/history", response_model=list[HistoryItem])
def get_history(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    sessions = db.exec(
        select(ReadingSession)
        .where(ReadingSession.user_id == user.id)
        .order_by(ReadingSession.date.desc())  # type: ignore[union-attr]
        .limit(50)
    ).all()
    return [
        HistoryItem(
            id=s.id,
            date=s.date.isoformat(),
            content_type=s.content_type,
            level=s.level,
            topic=s.topic,
            score_pct=s.score_pct,
            total_questions=s.total_questions,
            correct_count=s.correct_count,
            duration_seconds=s.duration_seconds,
        )
        for s in sessions
    ]
