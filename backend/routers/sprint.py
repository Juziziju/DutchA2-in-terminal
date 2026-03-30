"""Sprint router — 20-day A2 Spreken crash course endpoints."""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, col

from fastapi import BackgroundTasks

from backend.core.audio import ensure_vocab_audio
from backend.data.sprint_plan import SPRINT_DAYS, SPRINT_PHASES, get_sprint_day, get_sprint_overview
from backend.data.sprint_plan import get_sprint_questions
from backend.data.spreken_vocab import (
    SPREKEN_TOPICS,
    SPREKEN_VOCAB,
    get_vocab_by_onderdeel,
    get_vocab_by_topic,
    get_vocab_for_day,
)
from backend.database import get_session
from backend.models.sprint import SprintProgress
from backend.models.speaking import SpeakingSession
from backend.models.user import User
from backend.models.user_profile import UserProfile
from backend.models.vocab import Vocab
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/sprint", tags=["sprint"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class ActivateResponse(BaseModel):
    start_date: date
    exam_date: date
    current_day: int
    total_days: int


class DayProgressInput(BaseModel):
    reviewed: int = 0
    mastered: int = 0


class SpeakingProgressInput(BaseModel):
    sessions: int = 0
    avg_score: Optional[int] = None


# ── Helpers ──────────────────────────────────────────────────────────────────


def _get_or_create_profile(db: Session, user_id: int) -> UserProfile:
    profile = db.exec(select(UserProfile).where(UserProfile.user_id == user_id)).first()
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _get_sprint_start(profile: UserProfile) -> date | None:
    """Derive sprint start from exam_date (start = exam_date - 19 days)."""
    if not profile.exam_date:
        return None
    return profile.exam_date - __import__("datetime").timedelta(days=19)


def _current_sprint_day(profile: UserProfile) -> int:
    """Return the current sprint day (1-20) or 0 if not active."""
    start = _get_sprint_start(profile)
    if not start:
        return 0
    delta = (date.today() - start).days + 1  # day 1 on start date
    if delta < 1:
        return 0
    if delta > 20:
        return 21  # past sprint
    return delta


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/activate", response_model=ActivateResponse)
def activate_sprint(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Activate the 20-day sprint. Sets exam_date to today + 19 days."""
    profile = _get_or_create_profile(db, user.id)
    start = date.today()
    exam = start + __import__("datetime").timedelta(days=19)
    profile.exam_date = exam
    profile.goal = "exam"
    profile.updated_at = datetime.utcnow()
    db.add(profile)
    db.commit()
    return ActivateResponse(
        start_date=start,
        exam_date=exam,
        current_day=1,
        total_days=20,
    )


@router.post("/sync-vocab")
def sync_sprint_vocab(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Import sprint vocab into Vocab table with TTS audio generation."""
    added = 0
    updated = 0
    for entry in SPREKEN_VOCAB:
        existing = db.exec(
            select(Vocab).where(Vocab.dutch == entry["dutch"])
        ).first()
        if existing:
            # Update category to Sprint prefix if not already
            topic_names_upd = SPREKEN_TOPICS.get(entry["topic"], {})
            topic_en_upd = topic_names_upd.get("en", entry["topic"].replace("_", " ").title())
            new_cat = f"Sprint: {topic_en_upd}"
            if existing.category != new_cat:
                existing.category = new_cat
                db.add(existing)
                updated += 1
            continue
        topic_names = SPREKEN_TOPICS.get(entry["topic"], {})
        topic_en = topic_names.get("en", entry["topic"].replace("_", " ").title())
        category = f"Sprint: {topic_en}"
        try:
            audio_file = ensure_vocab_audio(entry["dutch"])
        except Exception:
            audio_file = ""
        vocab = Vocab(
            dutch=entry["dutch"],
            english=entry["english"],
            category=category,
            example_dutch=entry.get("example_sentence", ""),
            example_english="",
            audio_file=audio_file,
        )
        db.add(vocab)
        added += 1
    db.commit()
    return {"added": added, "updated": updated, "total": len(SPREKEN_VOCAB)}


@router.get("/overview")
def sprint_overview(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return all 20 days with completion status."""
    profile = _get_or_create_profile(db, user.id)
    current = _current_sprint_day(profile)

    # Fetch all progress records for this user
    progress_rows = db.exec(
        select(SprintProgress).where(SprintProgress.user_id == user.id)
    ).all()
    progress_map = {p.sprint_day: p for p in progress_rows}

    days = []
    for d in get_sprint_overview():
        p = progress_map.get(d["day"])
        days.append({
            **d,
            "is_current": d["day"] == current,
            "is_past": d["day"] < current,
            "completed": p.completed if p else False,
            "vocab_reviewed": p.vocab_reviewed if p else 0,
            "vocab_mastered": p.vocab_mastered if p else 0,
            "speaking_sessions": p.speaking_sessions if p else 0,
            "speaking_avg_score": p.speaking_avg_score if p else None,
        })

    start = _get_sprint_start(profile)
    return {
        "active": current > 0 and current <= 20,
        "current_day": current,
        "start_date": start.isoformat() if start else None,
        "exam_date": profile.exam_date.isoformat() if profile.exam_date else None,
        "days_remaining": max(0, 20 - current + 1) if current > 0 else 20,
        "completed_count": sum(1 for p in progress_rows if p.completed),
        "days": days,
    }


@router.get("/day/{day_num}")
def get_day_detail(
    day_num: int,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return full day plan with vocab and speaking config."""
    if day_num < 1 or day_num > 20:
        raise HTTPException(status_code=400, detail="Day must be between 1 and 20")

    day = get_sprint_day(day_num)
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    # Get vocab for this day, enriched with audio_file from Vocab table
    raw_vocab = get_vocab_for_day(day_num)
    # Build audio lookup from DB
    dutch_words = [v["dutch"] for v in raw_vocab]
    audio_map: dict[str, str] = {}
    if dutch_words:
        vocab_rows = db.exec(select(Vocab).where(Vocab.dutch.in_(dutch_words))).all()  # type: ignore
        audio_map = {v.dutch: v.audio_file for v in vocab_rows if v.audio_file}
    vocab = [{**v, "audio_file": audio_map.get(v["dutch"], "")} for v in raw_vocab]

    # Get progress
    progress = db.exec(
        select(SprintProgress).where(
            SprintProgress.user_id == user.id,
            SprintProgress.sprint_day == day_num,
        )
    ).first()

    # Get phase info
    phase = next((p for p in SPRINT_PHASES if p["phase"] == day["phase"]), None)

    return {
        **day,
        "phase_info": phase,
        "vocab": vocab,
        "vocab_total": len(vocab),
        "progress": {
            "vocab_reviewed": progress.vocab_reviewed if progress else 0,
            "vocab_mastered": progress.vocab_mastered if progress else 0,
            "speaking_sessions": progress.speaking_sessions if progress else 0,
            "speaking_avg_score": progress.speaking_avg_score if progress else None,
            "completed": progress.completed if progress else False,
        },
    }


@router.get("/day/{day_num}/questions")
def get_day_questions(day_num: int):
    """Return speaking practice questions for a sprint day."""
    if day_num < 1 or day_num > 20:
        raise HTTPException(status_code=400, detail="Day must be between 1 and 20")
    return get_sprint_questions(day_num)


@router.get("/latest-exam-score")
def get_latest_exam_score(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get the latest spreken exam score for linking to sprint mock exam days."""
    latest = db.exec(
        select(SpeakingSession)
        .where(
            SpeakingSession.user_id == user.id,
            SpeakingSession.mode == "spreken_exam",
        )
        .order_by(SpeakingSession.date.desc())  # type: ignore
        .limit(1)
    ).first()
    if not latest:
        return {"has_score": False}
    return {
        "has_score": True,
        "score_pct": latest.score_pct,
        "date": latest.date.isoformat() if latest.date else None,
        "session_id": latest.id,
    }


@router.get("/vocab")
def get_sprint_vocab(
    topic: Optional[str] = None,
    onderdeel: Optional[int] = None,
    day: Optional[int] = None,
):
    """Return sprint vocab filtered by topic, onderdeel, or day."""
    if day is not None:
        return get_vocab_for_day(day)
    if topic:
        return get_vocab_by_topic(topic)
    if onderdeel:
        return get_vocab_by_onderdeel(onderdeel)
    return SPREKEN_VOCAB


@router.get("/topics")
def get_topics():
    """Return all sprint vocab topics with counts."""
    result = []
    for slug, names in SPREKEN_TOPICS.items():
        count = len([v for v in SPREKEN_VOCAB if v["topic"] == slug])
        result.append({"slug": slug, **names, "count": count})
    return result


@router.post("/day/{day_num}/complete-vocab")
def complete_vocab(
    day_num: int,
    data: DayProgressInput,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Log vocab review completion for a sprint day."""
    if day_num < 1 or day_num > 20:
        raise HTTPException(status_code=400, detail="Day must be between 1 and 20")

    progress = db.exec(
        select(SprintProgress).where(
            SprintProgress.user_id == user.id,
            SprintProgress.sprint_day == day_num,
        )
    ).first()

    if not progress:
        progress = SprintProgress(user_id=user.id, sprint_day=day_num)

    progress.vocab_reviewed = data.reviewed
    progress.vocab_mastered = data.mastered

    # Auto-complete if both vocab and speaking are done
    if progress.vocab_reviewed > 0 and progress.speaking_sessions > 0:
        progress.completed = True
        progress.completed_at = datetime.utcnow()

    db.add(progress)
    db.commit()
    db.refresh(progress)
    return {"ok": True, "progress": {
        "vocab_reviewed": progress.vocab_reviewed,
        "vocab_mastered": progress.vocab_mastered,
        "completed": progress.completed,
    }}


@router.post("/day/{day_num}/complete-speaking")
def complete_speaking(
    day_num: int,
    data: SpeakingProgressInput,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Log speaking completion for a sprint day."""
    if day_num < 1 or day_num > 20:
        raise HTTPException(status_code=400, detail="Day must be between 1 and 20")

    progress = db.exec(
        select(SprintProgress).where(
            SprintProgress.user_id == user.id,
            SprintProgress.sprint_day == day_num,
        )
    ).first()

    if not progress:
        progress = SprintProgress(user_id=user.id, sprint_day=day_num)

    progress.speaking_sessions = data.sessions
    progress.speaking_avg_score = data.avg_score

    # Auto-complete if both vocab and speaking are done
    if progress.vocab_reviewed > 0 and progress.speaking_sessions > 0:
        progress.completed = True
        progress.completed_at = datetime.utcnow()

    db.add(progress)
    db.commit()
    db.refresh(progress)
    return {"ok": True, "progress": {
        "speaking_sessions": progress.speaking_sessions,
        "speaking_avg_score": progress.speaking_avg_score,
        "completed": progress.completed,
    }}


@router.get("/stats")
def get_sprint_stats(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return aggregate sprint statistics."""
    rows = db.exec(
        select(SprintProgress).where(SprintProgress.user_id == user.id)
    ).all()

    total_vocab_reviewed = sum(r.vocab_reviewed for r in rows)
    total_vocab_mastered = sum(r.vocab_mastered for r in rows)
    total_speaking = sum(r.speaking_sessions for r in rows)
    days_completed = sum(1 for r in rows if r.completed)

    scores = [r.speaking_avg_score for r in rows if r.speaking_avg_score is not None]
    avg_speaking_score = round(sum(scores) / len(scores)) if scores else None

    # Score by phase
    phase_scores: dict[int, list[int]] = {1: [], 2: [], 3: []}
    for r in rows:
        day_data = get_sprint_day(r.sprint_day)
        if day_data and r.speaking_avg_score is not None:
            phase_scores[day_data["phase"]].append(r.speaking_avg_score)

    return {
        "days_completed": days_completed,
        "total_days": 20,
        "total_vocab_reviewed": total_vocab_reviewed,
        "total_vocab_mastered": total_vocab_mastered,
        "total_speaking_sessions": total_speaking,
        "avg_speaking_score": avg_speaking_score,
        "phase_avg_scores": {
            p: round(sum(s) / len(s)) if s else None
            for p, s in phase_scores.items()
        },
        "score_trend": [
            {"day": r.sprint_day, "score": r.speaking_avg_score}
            for r in sorted(rows, key=lambda r: r.sprint_day)
            if r.speaking_avg_score is not None
        ],
    }


@router.get("/weak-topics")
def get_weak_topics(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Identify the 3 weakest topics based on speaking scores."""
    rows = db.exec(
        select(SprintProgress).where(
            SprintProgress.user_id == user.id,
            SprintProgress.speaking_avg_score != None,  # noqa: E711
        )
    ).all()

    # Map day → topics, aggregate scores per topic
    topic_scores: dict[str, list[int]] = {}
    for r in rows:
        day_data = get_sprint_day(r.sprint_day)
        if not day_data or r.speaking_avg_score is None:
            continue
        for topic_slug in day_data.get("vocab_topics", []):
            if topic_slug.startswith("connectors"):
                continue
            topic_scores.setdefault(topic_slug, []).append(r.speaking_avg_score)

    # Sort by average score (ascending = weakest first)
    ranked = sorted(
        [
            {"topic": t, "avg_score": round(sum(s) / len(s)), "sessions": len(s)}
            for t, s in topic_scores.items()
        ],
        key=lambda x: x["avg_score"],
    )

    # Add display names
    for item in ranked:
        names = SPREKEN_TOPICS.get(item["topic"], {})
        item["name_en"] = names.get("en", item["topic"])
        item["name_nl"] = names.get("nl", item["topic"])

    return {"weak_topics": ranked[:3], "all_topics": ranked}
