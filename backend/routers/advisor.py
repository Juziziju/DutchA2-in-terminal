"""Advisor router — AI learning advisor that reads all user data."""

import json
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select, func

from backend.core.advisor_ai import get_advisor_response_structured, stream_advisor_response
from backend.core.metrics import (
    classify_level,
    get_active_dates,
    compute_streak,
    get_vocab_categories,
    get_listening_trend_7d,
    get_speaking_subscores,
    get_days_until_exam,
    get_planner_rate_7d,
    get_skill_practice_counts,
    get_review_consistency_30d,
    get_skill_snapshots,
    get_flashcard_stats,
    build_progress_by_vid,
)
from backend.database import get_session
from backend.models.exam import ExamResult
from backend.models.listening import ListeningSession
from backend.models.placement import PlacementResult
from backend.models.progress import FlashcardProgress
from backend.models.review_log import FlashcardReviewLog
from backend.models.speaking import SpeakingSession
from backend.models.daily_plan import DailyPlan, TaskLog
from backend.models.user import User
from backend.models.user_profile import UserProfile
from backend.models.vocab import Vocab
from backend.models.weekly_report import WeeklyReport
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/advisor", tags=["advisor"])


class AdvisorRequest(BaseModel):
    message: str


class AdvisorTask(BaseModel):
    task_type: str
    description: str
    route: str


class AdvisorResponse(BaseModel):
    reply: str
    suggested_tasks: list[AdvisorTask] = []


def _gather_data(user: User, db: Session) -> dict:
    """Gather all user data for the advisor context."""
    today = date.today()
    cutoff_30d = today - timedelta(days=30)

    # 1. Profile
    profile_row = db.exec(
        select(UserProfile).where(UserProfile.user_id == user.id)
    ).first()
    profile = {}
    if profile_row:
        profile = {
            "goal": profile_row.goal,
            "current_level": profile_row.current_level,
            "timeline_months": profile_row.timeline_months,
            "daily_minutes": profile_row.daily_minutes,
            "weak_skills": json.loads(profile_row.weak_skills) if profile_row.weak_skills else [],
            "exam_date": profile_row.exam_date.isoformat() if profile_row.exam_date else None,
            "start_date": profile_row.start_date.isoformat() if profile_row.start_date else None,
        }

    # 2. Placement
    placement_row = db.exec(
        select(PlacementResult).where(PlacementResult.user_id == user.id)
    ).first()
    placement = {}
    if placement_row:
        placement = {
            "vocab_score": placement_row.vocab_score,
            "listening_score": placement_row.listening_score,
            "reading_score": placement_row.reading_score,
            "writing_score": placement_row.writing_score,
            "overall_level": placement_row.overall_level,
        }

    # 3. Flashcard stats
    fc_data = get_flashcard_stats(user, db, today)
    all_progress = fc_data.pop("_all_progress")
    flashcard_stats = fc_data

    # 4. Vocab level counts
    all_vocab = db.exec(select(Vocab)).all()
    progress_by_vid = build_progress_by_vid(all_progress)

    level_counts: dict[str, int] = defaultdict(int)
    for v in all_vocab:
        progs = progress_by_vid.get(v.id, {})
        level = classify_level(progs.get("nl_en"), progs.get("en_nl"))
        level_counts[level] += 1

    # 5. Listening stats (30d)
    listening_rows = db.exec(
        select(ListeningSession).where(
            ListeningSession.user_id == user.id,
            ListeningSession.date >= cutoff_30d.isoformat(),
        )
    ).all()
    quiz_rows = [r for r in listening_rows if (r.mode or "quiz") == "quiz"]
    intensive_rows = [r for r in listening_rows if r.mode == "intensive"]
    listening = {
        "total_sessions": len(listening_rows),
        "quiz_sessions": len(quiz_rows),
        "intensive_sessions": len(intensive_rows),
        "avg_score_quiz": round(sum(r.score_pct for r in quiz_rows) / len(quiz_rows), 1) if quiz_rows else None,
        "avg_score_intensive": round(sum(r.score_pct for r in intensive_rows) / len(intensive_rows), 1) if intensive_rows else None,
    }

    # 6. Speaking stats (30d)
    speaking_rows = db.exec(
        select(SpeakingSession).where(
            SpeakingSession.user_id == user.id,
            SpeakingSession.date >= cutoff_30d.isoformat(),
        )
    ).all()
    scored_speaking = [r for r in speaking_rows if r.score_pct is not None]
    speaking = {
        "total_sessions": len(speaking_rows),
        "avg_score": round(sum(r.score_pct for r in scored_speaking) / len(scored_speaking), 1) if scored_speaking else None,
    }

    # 7. Latest exam
    latest_exam = db.exec(
        select(ExamResult)
        .where(ExamResult.user_id == user.id)
        .order_by(ExamResult.date.desc())
        .limit(1)
    ).first()
    exam = {}
    if latest_exam:
        exam = {
            "avg_score": latest_exam.avg_score,
            "passed": latest_exam.passed,
            "scores": json.loads(latest_exam.scores_json) if latest_exam.scores_json else {},
            "date": latest_exam.date.strftime("%Y-%m-%d") if hasattr(latest_exam.date, "strftime") else str(latest_exam.date)[:10],
        }

    # 8. Skill snapshots (latest per skill)
    skill_list = get_skill_snapshots(user, db)

    # 9. Latest weekly report
    latest_report = db.exec(
        select(WeeklyReport)
        .where(WeeklyReport.user_id == user.id)
        .order_by(WeeklyReport.generated_at.desc())
        .limit(1)
    ).first()
    weekly = {}
    if latest_report:
        weekly = json.loads(latest_report.report_json) if latest_report.report_json else {}

    # 10. Streak
    active_dates = get_active_dates(user, db)
    streak = compute_streak(active_dates, today)

    # --- NEW METRICS (shared helpers) ---
    vocab_categories = get_vocab_categories(all_vocab, progress_by_vid)
    listening_trend = get_listening_trend_7d(user, db, today)
    speaking_subscores = get_speaking_subscores(speaking_rows)
    days_until_exam, _ = get_days_until_exam(user, db, today)
    planner_rate = get_planner_rate_7d(user, db, today)
    skill_counts, most_practiced, least_practiced = get_skill_practice_counts(user, db, today)
    review_consistency_days, _ = get_review_consistency_30d(user, db, today)

    return {
        "profile": profile,
        "placement": placement,
        "flashcard_stats": flashcard_stats,
        "vocab_levels": dict(level_counts),
        "listening": listening,
        "speaking": speaking,
        "exam": exam,
        "skill_snapshots": skill_list,
        "weekly_report": weekly,
        "streak": streak,
        "today": today.isoformat(),
        # New metrics
        "vocab_categories": vocab_categories,
        "listening_trend_7d": listening_trend,
        "speaking_subscores": speaking_subscores,
        "days_until_exam": days_until_exam,
        "planner_completion_rate_7d": planner_rate,
        "most_practiced_skill": most_practiced,
        "least_practiced_skill": least_practiced,
        "review_consistency_30d": review_consistency_days,
    }


@router.post("/ask", response_model=AdvisorResponse)
def ask_advisor(
    req: AdvisorRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    data = _gather_data(user, db)
    result = get_advisor_response_structured(data, req.message.strip())
    tasks = [
        AdvisorTask(**t) for t in result.get("suggested_tasks", [])
        if isinstance(t, dict) and "task_type" in t and "description" in t and "route" in t
    ]
    return AdvisorResponse(reply=result["reply"], suggested_tasks=tasks)


@router.post("/ask-stream")
def ask_advisor_stream(
    req: AdvisorRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    data = _gather_data(user, db)

    def generate():
        for chunk in stream_advisor_response(data, req.message.strip()):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")
