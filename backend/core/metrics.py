"""Shared metric computation functions used by dashboard insights and AI advisor."""

import json
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from sqlmodel import Session, select, func

from backend.models.daily_plan import DailyPlan, TaskLog
from backend.models.exam import ExamResult
from backend.models.listening import ListeningSession
from backend.models.progress import FlashcardProgress
from backend.models.review_log import FlashcardReviewLog
from backend.models.skill_snapshot import SkillSnapshot
from backend.models.speaking import SpeakingSession
from backend.models.user import User
from backend.models.user_profile import UserProfile
from backend.models.vocab import Vocab


def _date_str(dt) -> str:
    return dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else str(dt)[:10]


def classify_level(prog_nl: Optional[FlashcardProgress], prog_en: Optional[FlashcardProgress]) -> str:
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


def get_active_dates(user: User, db: Session) -> set[str]:
    """Collect all dates on which the user had any study activity."""
    active_dates: set[str] = set()

    fc_logs = db.exec(
        select(FlashcardReviewLog).where(FlashcardReviewLog.user_id == user.id)
    ).all()
    for log in fc_logs:
        active_dates.add(_date_str(log.created_at))

    for r in db.exec(select(ListeningSession).where(ListeningSession.user_id == user.id)).all():
        active_dates.add(_date_str(r.date))

    for r in db.exec(select(SpeakingSession).where(SpeakingSession.user_id == user.id)).all():
        active_dates.add(_date_str(r.date))

    for r in db.exec(select(ExamResult).where(ExamResult.user_id == user.id)).all():
        active_dates.add(_date_str(r.date))

    return active_dates


def compute_streak(active_dates: set[str], today: date | None = None) -> int:
    """Count consecutive study days backwards from today."""
    if today is None:
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
    return streak


def get_vocab_categories(all_vocab: list, progress_by_vid: dict) -> list[dict]:
    """Top 5 weakest vocab categories by mastery ratio."""
    cat_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"mastered": 0, "total": 0})
    for v in all_vocab:
        progs = progress_by_vid.get(v.id, {})
        level = classify_level(progs.get("nl_en"), progs.get("en_nl"))
        cat_stats[v.category]["total"] += 1
        if level == "mastered":
            cat_stats[v.category]["mastered"] += 1
    weakest_cats = sorted(
        cat_stats.items(),
        key=lambda x: (x[1]["mastered"] / x[1]["total"]) if x[1]["total"] > 0 else 0,
    )[:5]
    return [
        {"category": cat, "mastered": s["mastered"], "total": s["total"]}
        for cat, s in weakest_cats
    ]


def get_listening_trend_7d(user: User, db: Session, today: date | None = None) -> float | None:
    """Delta between avg listening score last 7d vs prior 7d."""
    if today is None:
        today = date.today()
    cutoff_7d = today - timedelta(days=7)
    cutoff_14d = today - timedelta(days=14)
    all_listening_14d = db.exec(
        select(ListeningSession).where(
            ListeningSession.user_id == user.id,
            ListeningSession.date >= cutoff_14d.isoformat(),
        )
    ).all()
    recent_7d = [r for r in all_listening_14d if _date_str(r.date) >= cutoff_7d.isoformat()]
    prior_7d = [r for r in all_listening_14d if _date_str(r.date) < cutoff_7d.isoformat()]
    avg_recent = round(sum(r.score_pct for r in recent_7d) / len(recent_7d), 1) if recent_7d else None
    avg_prior = round(sum(r.score_pct for r in prior_7d) / len(prior_7d), 1) if prior_7d else None
    if avg_recent is not None and avg_prior is not None:
        return round(avg_recent - avg_prior, 1)
    return None


def get_speaking_subscores(speaking_rows: list) -> dict[str, float | None]:
    """Average speaking sub-scores (vocabulary, grammar, completeness) from 30d sessions."""
    speaking_sub: dict[str, list] = {"vocabulary": [], "grammar": [], "completeness": []}
    for r in speaking_rows:
        try:
            fb = json.loads(r.feedback_json) if r.feedback_json else {}
        except (json.JSONDecodeError, TypeError):
            fb = {}
        if fb.get("vocabulary_score") is not None:
            speaking_sub["vocabulary"].append(fb["vocabulary_score"])
        if fb.get("grammar_score") is not None:
            speaking_sub["grammar"].append(fb["grammar_score"])
        if fb.get("completeness_score") is not None:
            speaking_sub["completeness"].append(fb["completeness_score"])
    return {
        k: round(sum(v) / len(v), 1) if v else None
        for k, v in speaking_sub.items()
    }


def get_days_until_exam(user: User, db: Session, today: date | None = None) -> tuple[int | None, str | None]:
    """Returns (days_until_exam, exam_date_iso) or (None, None)."""
    if today is None:
        today = date.today()
    profile_row = db.exec(
        select(UserProfile).where(UserProfile.user_id == user.id)
    ).first()
    if not profile_row or not profile_row.exam_date:
        return None, None
    try:
        days = (profile_row.exam_date - today).days
        return days, profile_row.exam_date.isoformat()
    except (ValueError, TypeError):
        return None, None


def get_planner_rate_7d(user: User, db: Session, today: date | None = None) -> float | None:
    """7-day planner task completion rate as percentage."""
    if today is None:
        today = date.today()
    cutoff = today - timedelta(days=7)
    recent_plans = db.exec(
        select(DailyPlan).where(
            DailyPlan.user_id == user.id,
            DailyPlan.plan_date >= cutoff,
        )
    ).all()
    plan_ids = [p.id for p in recent_plans]
    if not plan_ids:
        return None
    recent_tasks = db.exec(
        select(TaskLog).where(TaskLog.plan_id.in_(plan_ids))
    ).all()
    if not recent_tasks:
        return None
    completed = sum(1 for t in recent_tasks if t.status == "completed")
    return round(100 * completed / len(recent_tasks), 1)


def get_skill_practice_counts(user: User, db: Session, today: date | None = None) -> tuple[dict[str, int], str | None, str | None]:
    """Returns (skill_counts, most_practiced, least_practiced) for last 30d."""
    if today is None:
        today = date.today()
    cutoff = today - timedelta(days=30)
    all_task_logs = db.exec(
        select(TaskLog).where(
            TaskLog.user_id == user.id,
            TaskLog.created_at >= cutoff.isoformat(),
        )
    ).all()
    skill_freq: dict[str, int] = defaultdict(int)
    for t in all_task_logs:
        if t.task_type:
            skill_freq[t.task_type] += 1
    most = max(skill_freq, key=skill_freq.get) if skill_freq else None
    least = min(skill_freq, key=skill_freq.get) if skill_freq else None
    return dict(skill_freq), most, least


def get_review_consistency_30d(user: User, db: Session, today: date | None = None) -> tuple[int, list[str]]:
    """Returns (count_of_active_days, sorted_list_of_dates) for last 30d flashcard reviews."""
    if today is None:
        today = date.today()
    cutoff = today - timedelta(days=30)
    fc_logs = db.exec(
        select(FlashcardReviewLog).where(FlashcardReviewLog.user_id == user.id)
    ).all()
    review_dates: set[str] = set()
    for log in fc_logs:
        log_date = _date_str(log.created_at)
        if log_date >= cutoff.isoformat():
            review_dates.add(log_date)
    return len(review_dates), sorted(review_dates)


def get_skill_snapshots(user: User, db: Session) -> list[dict]:
    """Latest skill snapshot per skill."""
    snapshots = db.exec(
        select(SkillSnapshot)
        .where(SkillSnapshot.user_id == user.id)
        .order_by(SkillSnapshot.snapshot_date.desc())
    ).all()
    seen: set[str] = set()
    result = []
    for s in snapshots:
        if s.skill not in seen:
            seen.add(s.skill)
            result.append({
                "skill": s.skill,
                "assessed_level": s.assessed_level,
                "avg_score": s.avg_score,
            })
    return result


def get_flashcard_stats(user: User, db: Session, today: date | None = None) -> dict:
    """Basic flashcard stats: total_cards, mastered, due_today, total_reviewed."""
    if today is None:
        today = date.today()
    all_progress = db.exec(
        select(FlashcardProgress).where(FlashcardProgress.user_id == user.id)
    ).all()
    reviewed_rows = [r for r in all_progress if r.repetitions > 0]
    mastered_count = sum(1 for r in all_progress if r.mastered)
    due_today = sum(1 for r in reviewed_rows if not r.mastered and r.next_review <= today)
    total_vocab = db.exec(select(func.count()).select_from(Vocab)).one()
    return {
        "total_cards": total_vocab,
        "mastered": mastered_count,
        "due_today": due_today,
        "total_reviewed": len(reviewed_rows),
        "_all_progress": all_progress,  # internal: reused by callers
    }


def build_progress_by_vid(all_progress: list) -> dict[int, dict[str, FlashcardProgress]]:
    """Build vocab_id -> {direction: FlashcardProgress} mapping."""
    result: dict[int, dict[str, FlashcardProgress]] = defaultdict(dict)
    for p in all_progress:
        result[p.vocab_id][p.direction] = p
    return result
