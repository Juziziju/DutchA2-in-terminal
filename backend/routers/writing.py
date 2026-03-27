"""Writing router — generate prompts, submit responses, get AI feedback."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, col

from backend.core.writing_ai import generate_writing_prompt, review_writing, generate_error_correction, grade_error_correction
from backend.core.spell_scenes import SPELL_SCENES
from backend.core.spell_ai import generate_spell_exercise, grade_spell_exercise, review_translation
from backend.data.schrijven_exams import get_schrijven_exam, get_schrijven_exam_list, get_schrijven_task
from backend.data.writing_subtopics import WRITING_SUBTOPICS, get_subtopic
from backend.database import get_session
from backend.models.writing import WritingSession, WritingErrorWeight
from backend.models.user import User
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/writing", tags=["writing"])


# ── Generate ─────────────────────────────────────────────────────────────────


VALID_TASK_TYPES = ("email", "kort_verhaal", "formulier", "briefje", "error_correction")


class GenerateRequest(BaseModel):
    task_type: str = "email"  # "email" | "kort_verhaal" | "formulier" | "error_correction"
    topic: str = ""
    subtopic: str | None = None


@router.post("/generate")
def generate(
    req: GenerateRequest | None = None,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    body = req or GenerateRequest()
    task_type = body.task_type if body.task_type in VALID_TASK_TYPES else "email"

    # If subtopic given, use its description as topic hint
    topic = body.topic
    subtopic_key = body.subtopic
    if subtopic_key and not topic:
        st = get_subtopic(task_type, subtopic_key)
        if st:
            topic = st["description"]

    # Fetch user's top error categories to bias prompt generation
    weights = db.exec(
        select(WritingErrorWeight)
        .where(WritingErrorWeight.user_id == user.id)
        .order_by(col(WritingErrorWeight.count).desc())
        .limit(5)
    ).all()
    weak_categories = [w.error_category for w in weights if w.count > 0]

    try:
        if task_type == "error_correction":
            data = generate_error_correction(
                topic=topic,
                weak_categories=weak_categories or None,
            )
        else:
            data = generate_writing_prompt(
                task_type=task_type,
                topic=topic,
                weak_categories=weak_categories or None,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Attach subtopic key to response so frontend can pass it back on submit
    if subtopic_key:
        data["subtopic"] = subtopic_key

    return data


# ── Submit ───────────────────────────────────────────────────────────────────


class SubmitRequest(BaseModel):
    task_type: str
    prompt: dict  # the full prompt object from generate
    response_text: str  # user's writing (or JSON-serialized form answers for formulier)
    duration_seconds: int | None = None
    subtopic: str | None = None


class ContentChecklistItem(BaseModel):
    point_nl: str = ""
    point_en: str = ""
    addressed: bool = False


class GrammarError(BaseModel):
    text: str
    correction: str
    # New fields
    rule_nl: str = ""
    explanation_zh: str = ""
    # Legacy fields (backward compat)
    category: str = ""
    explanation_en: str = ""


class WritingFeedback(BaseModel):
    score: int
    # New 6-point fields
    content_score: int = 0
    language_score: int = 0
    content_checklist: list[ContentChecklistItem] = []
    # Legacy fields (backward compat)
    grammar_score: int = 0
    completeness_score: int = 0
    grammar_errors: list[GrammarError]
    feedback_nl: str
    feedback_en: str = ""
    improved_answer: str


class SubmitResponse(BaseModel):
    session_id: int
    score_pct: int
    feedback: WritingFeedback


def _upsert_error_weights(db: Session, user_id: int, error_categories: list[str]):
    """Increment error weight counts for the given categories."""
    now = datetime.utcnow()
    for cat in error_categories:
        existing = db.exec(
            select(WritingErrorWeight).where(
                WritingErrorWeight.user_id == user_id,
                WritingErrorWeight.error_category == cat,
            )
        ).first()
        if existing:
            existing.count += 1
            existing.last_seen = now
            db.add(existing)
        else:
            db.add(WritingErrorWeight(
                user_id=user_id,
                error_category=cat,
                count=1,
                last_seen=now,
            ))


@router.post("/submit", response_model=SubmitResponse)
def submit(
    req: SubmitRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task_type = req.task_type if req.task_type in ("email", "kort_verhaal", "formulier", "briefje") else "email"

    try:
        feedback = review_writing(task_type, req.prompt, req.response_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    score_pct = feedback.get("score", 0)

    # Resolve subtopic: explicit param > prompt metadata
    subtopic = req.subtopic or req.prompt.get("subtopic")

    # Save session
    session = WritingSession(
        user_id=user.id,
        task_type=task_type,
        subtopic=subtopic,
        topic=req.prompt.get("topic", ""),
        score_pct=score_pct,
        duration_seconds=req.duration_seconds,
        prompt_json=json.dumps(req.prompt, ensure_ascii=False),
        response_text=req.response_text,
        feedback_json=json.dumps(feedback, ensure_ascii=False),
    )
    db.add(session)

    # Update error weights
    error_cats = [e.get("category", "other") for e in feedback.get("grammar_errors", [])]
    _upsert_error_weights(db, user.id, error_cats)

    db.commit()
    db.refresh(session)

    # Build typed response
    grammar_errors = [
        GrammarError(
            text=e.get("text", ""),
            correction=e.get("correction", ""),
            rule_nl=e.get("rule_nl", ""),
            explanation_zh=e.get("explanation_zh", ""),
            category=e.get("category", "other"),
            explanation_en=e.get("explanation_en", ""),
        )
        for e in feedback.get("grammar_errors", [])
    ]

    content_checklist = [
        ContentChecklistItem(
            point_nl=c.get("point_nl", ""),
            point_en=c.get("point_en", ""),
            addressed=c.get("addressed", False),
        )
        for c in feedback.get("content_checklist", [])
    ]

    return SubmitResponse(
        session_id=session.id,
        score_pct=score_pct,
        feedback=WritingFeedback(
            score=feedback.get("score", 0),
            content_score=feedback.get("content_score", 0),
            language_score=feedback.get("language_score", 0),
            content_checklist=content_checklist,
            grammar_score=feedback.get("grammar_score", 0),
            completeness_score=feedback.get("completeness_score", 0),
            grammar_errors=grammar_errors,
            feedback_nl=feedback.get("feedback_nl", ""),
            feedback_en=feedback.get("feedback_en", ""),
            improved_answer=feedback.get("improved_answer", ""),
        ),
    )


# ── Error Correction Submit ──────────────────────────────────────────────────


class SentenceAnswer(BaseModel):
    sentence_index: int
    marked_error: bool
    user_correction: str | None = None


class ErrorCorrectionSubmitRequest(BaseModel):
    prompt: dict
    answers: list[SentenceAnswer]
    duration_seconds: int | None = None


@router.post("/submit-correction")
def submit_correction(
    req: ErrorCorrectionSubmitRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    feedback = grade_error_correction(
        req.prompt,
        [a.model_dump() for a in req.answers],
    )

    score_pct = feedback.get("score", 0)

    # Save session
    session = WritingSession(
        user_id=user.id,
        task_type="error_correction",
        topic=req.prompt.get("topic", ""),
        score_pct=score_pct,
        duration_seconds=req.duration_seconds,
        prompt_json=json.dumps(req.prompt, ensure_ascii=False),
        response_text=json.dumps([a.model_dump() for a in req.answers], ensure_ascii=False),
        feedback_json=json.dumps(feedback, ensure_ascii=False),
    )
    db.add(session)

    # Update error weights for missed and incorrectly fixed errors
    weak_cats = [
        r.get("category")
        for r in feedback.get("results", [])
        if r.get("has_error") and r.get("category") and (not r.get("found") or not r.get("fix_correct"))
    ]
    _upsert_error_weights(db, user.id, [c for c in weak_cats if c])

    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "score_pct": score_pct,
        "feedback": feedback,
    }


# ── Spell Practice ──────────────────────────────────────────────────────────


@router.get("/spell-scenes")
def list_spell_scenes(
    _user: User = Depends(get_current_user),
):
    """Return available spell practice scenes."""
    return SPELL_SCENES


class SpellGenerateRequest(BaseModel):
    scene_id: str
    level: str = "A2"


@router.post("/spell-generate")
def spell_generate(
    req: SpellGenerateRequest,
    _user: User = Depends(get_current_user),
):
    try:
        data = generate_spell_exercise(req.scene_id, req.level)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return data


class SpellAnswer(BaseModel):
    sentence_index: int
    user_text: str


class SpellSubmitRequest(BaseModel):
    prompt: dict
    answers: list[SpellAnswer]
    hints_used: list[int] = []
    duration_seconds: int | None = None


@router.post("/spell-submit")
def spell_submit(
    req: SpellSubmitRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    feedback = grade_spell_exercise(
        req.prompt,
        [a.model_dump() for a in req.answers],
        hints_used=req.hints_used or None,
    )

    score_pct = feedback.get("score", 0)

    session = WritingSession(
        user_id=user.id,
        task_type="spell_practice",
        topic=req.prompt.get("scene_title_en", ""),
        score_pct=score_pct,
        duration_seconds=req.duration_seconds,
        prompt_json=json.dumps(req.prompt, ensure_ascii=False),
        response_text=json.dumps([a.model_dump() for a in req.answers], ensure_ascii=False),
        feedback_json=json.dumps(feedback, ensure_ascii=False),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "score_pct": score_pct,
        "feedback": feedback,
    }


class TranslationReviewRequest(BaseModel):
    text_en: str
    text_nl: str
    user_text: str
    hints_used: int = 0


@router.post("/translation-review")
def translation_review(
    req: TranslationReviewRequest,
    _user: User = Depends(get_current_user),
):
    """AI review a single translation sentence with structured feedback."""
    try:
        result = review_translation(req.text_en, req.text_nl, req.user_text, req.hints_used)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result


# ── Subtopics ────────────────────────────────────────────────────────────────


@router.get("/subtopics")
def list_subtopics(
    _user: User = Depends(get_current_user),
):
    """Return the full subtopic catalogue."""
    return WRITING_SUBTOPICS


@router.get("/subtopic-scores")
def subtopic_scores(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return average score per (task_type, subtopic) over last 7 attempts."""
    from sqlmodel import func, col as sqcol

    # Get all sessions with a subtopic for this user
    rows = db.exec(
        select(
            WritingSession.task_type,
            WritingSession.subtopic,
            WritingSession.score_pct,
            WritingSession.date,
        )
        .where(
            WritingSession.user_id == user.id,
            WritingSession.subtopic.is_not(None),  # type: ignore[union-attr]
            WritingSession.score_pct.is_not(None),  # type: ignore[union-attr]
        )
        .order_by(col(WritingSession.date).desc())
    ).all()

    # Group by (task_type, subtopic), keep last 7
    from collections import defaultdict
    groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for task_type, subtopic, score_pct, _date in rows:
        key = (task_type, subtopic)
        if len(groups[key]) < 7:
            groups[key].append(score_pct)

    return [
        {
            "task_type": tt,
            "subtopic": st,
            "avg_score": round(sum(scores) / len(scores)),
            "count": len(scores),
        }
        for (tt, st), scores in groups.items()
    ]


@router.get("/trend")
def writing_trend(
    task_type: str | None = None,
    subtopic: str | None = None,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return daily score data points for writing trend charts."""
    from datetime import timedelta
    from collections import defaultdict

    cutoff = datetime.utcnow() - timedelta(days=days)
    stmt = select(WritingSession).where(
        WritingSession.user_id == user.id,
        WritingSession.date >= cutoff,
        WritingSession.score_pct.is_not(None),  # type: ignore[union-attr]
    )
    if task_type:
        stmt = stmt.where(WritingSession.task_type == task_type)
    if subtopic:
        stmt = stmt.where(WritingSession.subtopic == subtopic)

    rows = db.exec(stmt).all()

    by_day: dict[str, list[int]] = defaultdict(list)
    for r in rows:
        day = r.date.strftime("%Y-%m-%d") if hasattr(r.date, "strftime") else str(r.date)[:10]
        by_day[day].append(r.score_pct)

    return [
        {
            "date": day,
            "avg_score": round(sum(scores) / len(scores), 1),
            "count": len(scores),
        }
        for day, scores in sorted(by_day.items())
    ]


# ── Delete ───────────────────────────────────────────────────────────────────


@router.delete("/history/{session_id}")
def delete_writing_session(
    session_id: int,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Delete a writing session from history."""
    session = db.get(WritingSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"ok": True}


# ── History ──────────────────────────────────────────────────────────────────


class HistoryItem(BaseModel):
    id: int
    date: str
    task_type: str
    topic: str
    score_pct: int | None
    duration_seconds: int | None


class HistoryPage(BaseModel):
    items: list[HistoryItem]
    total: int
    page: int
    per_page: int
    pages: int


@router.get("/history", response_model=HistoryPage)
def get_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    task_type: str | None = None,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = select(WritingSession).where(WritingSession.user_id == user.id)
    if task_type:
        stmt = stmt.where(WritingSession.task_type == task_type)

    # Count total
    from sqlmodel import func
    count_stmt = select(func.count()).select_from(WritingSession).where(WritingSession.user_id == user.id)
    if task_type:
        count_stmt = count_stmt.where(WritingSession.task_type == task_type)
    total = db.exec(count_stmt).one()

    pages = max(1, (total + per_page - 1) // per_page)

    sessions = db.exec(
        stmt.order_by(col(WritingSession.date).desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    items = [
        HistoryItem(
            id=s.id,
            date=s.date.isoformat(),
            task_type=s.task_type,
            topic=s.topic,
            score_pct=s.score_pct,
            duration_seconds=s.duration_seconds,
        )
        for s in sessions
    ]

    return HistoryPage(items=items, total=total, page=page, per_page=per_page, pages=pages)


# ── Detail ───────────────────────────────────────────────────────────────────


@router.get("/detail/{session_id}")
def get_detail(
    session_id: int,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    session = db.get(WritingSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")

    prompt = json.loads(session.prompt_json) if session.prompt_json else {}
    feedback = json.loads(session.feedback_json) if session.feedback_json else {}

    return {
        "id": session.id,
        "date": session.date.isoformat(),
        "task_type": session.task_type,
        "topic": session.topic,
        "score_pct": session.score_pct,
        "duration_seconds": session.duration_seconds,
        "prompt": prompt,
        "response_text": session.response_text,
        "feedback": feedback,
    }


# ── Error Profile ────────────────────────────────────────────────────────────


class ErrorCategoryItem(BaseModel):
    category: str
    count: int
    last_seen: str


class ErrorProfile(BaseModel):
    categories: list[ErrorCategoryItem]


@router.get("/error-profile", response_model=ErrorProfile)
def get_error_profile(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    weights = db.exec(
        select(WritingErrorWeight)
        .where(WritingErrorWeight.user_id == user.id)
        .order_by(col(WritingErrorWeight.count).desc())
    ).all()

    return ErrorProfile(
        categories=[
            ErrorCategoryItem(
                category=w.error_category,
                count=w.count,
                last_seen=w.last_seen.isoformat(),
            )
            for w in weights
        ]
    )


# ── Mock Exams (Official DUO Schrijven) ──────────────────────────────────────


@router.get("/mock-exams")
def list_schrijven_exams(
    _user: User = Depends(get_current_user),
):
    """Return available schrijven oefenexamens."""
    return get_schrijven_exam_list()


@router.get("/mock-exams/{exam_id}")
def schrijven_exam_detail(
    exam_id: str,
    _user: User = Depends(get_current_user),
):
    """Return full schrijven exam with all tasks."""
    exam = get_schrijven_exam(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@router.get("/mock-exams/{exam_id}/tasks/{task_id}")
def schrijven_task_detail(
    exam_id: str,
    task_id: str,
    _user: User = Depends(get_current_user),
):
    """Return a single task from a schrijven exam."""
    task = get_schrijven_task(exam_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
