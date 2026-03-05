"""Planner router — adaptive learning planner endpoints."""

import json
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.core.planner_ai import (
    compute_adjustments,
    determine_level,
    generate_daily_plan,
    generate_placement_questions,
    generate_roadmap,
    generate_weekly_report,
    score_writing,
)
from backend.database import get_session
from backend.models.daily_plan import DailyPlan, TaskLog
from backend.models.exam import ExamResult
from backend.models.listening import ListeningSession
from backend.models.placement import PlacementResult
from backend.models.review_log import FlashcardReviewLog
from backend.models.skill_snapshot import SkillSnapshot
from backend.models.user import User
from backend.models.user_profile import UserProfile
from backend.models.weekly_report import Roadmap, WeeklyReport
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/planner", tags=["planner"])


# ── Pydantic Schemas ────────────────────────────────────────────────────────


class ProfileUpdate(BaseModel):
    language: Optional[str] = None
    goal: Optional[str] = None
    timeline_months: Optional[int] = None
    daily_minutes: Optional[int] = None
    current_level: Optional[str] = None
    exam_date: Optional[date] = None


class ProfileResponse(BaseModel):
    language: str
    planner_enabled: bool
    goal: Optional[str]
    timeline_months: Optional[int]
    daily_minutes: Optional[int]
    current_level: Optional[str]
    weak_skills: list[str]
    onboarding_completed: bool
    placement_completed: bool
    start_date: Optional[date]
    exam_date: Optional[date]


class StatusResponse(BaseModel):
    planner_enabled: bool
    step: str  # "language" | "goal" | "placement" | "ready"


class PlacementSubmitRequest(BaseModel):
    vocab_answers: list[str]  # ["A", "B", ...]
    listening_answers: list[str]
    reading_answers: list[str]
    writing_text: str
    questions: dict  # the original questions from /placement/start


class PlacementSubmitResponse(BaseModel):
    vocab_score: int
    listening_score: int
    reading_score: int
    writing_score: int
    writing_feedback: dict
    overall_level: str
    weak_skills: list[str]


class TaskResponse(BaseModel):
    id: int
    task_index: int
    task_type: str
    description: str
    duration_minutes: int
    difficulty: str
    status: str
    score: Optional[int]
    time_spent_seconds: Optional[int]


class DailyPlanResponse(BaseModel):
    id: int
    plan_date: date
    focus_headline: str
    coach_message: str
    progress_note: str
    tasks: list[TaskResponse]
    retry: bool = False


class TaskCompleteRequest(BaseModel):
    score: Optional[int] = None
    time_spent_seconds: Optional[int] = None


class HistoryItem(BaseModel):
    plan_date: date
    focus_headline: str
    total_tasks: int
    completed_tasks: int
    completion_pct: int


class WeeklyReportResponse(BaseModel):
    week_start: date
    week_end: date
    report: dict


class RoadmapResponse(BaseModel):
    phases: list[dict]
    generated_at: datetime


# ── Helpers ──────────────────────────────────────────────────────────────────


def _get_or_create_profile(user: User, db: Session) -> UserProfile:
    profile = db.exec(
        select(UserProfile).where(UserProfile.user_id == user.id)
    ).first()
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _gather_recent_performance(user_id: int, db: Session, days: int = 7) -> dict:
    """Gather performance data from TaskLog + existing modules."""
    cutoff = date.today() - timedelta(days=days)

    # TaskLog data
    task_logs = db.exec(
        select(TaskLog).where(
            TaskLog.user_id == user_id,
            TaskLog.created_at >= cutoff.isoformat(),
        )
    ).all()

    completed = sum(1 for t in task_logs if t.status == "completed")
    skipped = sum(1 for t in task_logs if t.status == "skipped")

    # Scores by type
    from collections import defaultdict

    scores_by_type: dict[str, list[int]] = defaultdict(list)
    for t in task_logs:
        if t.score is not None:
            scores_by_type[t.task_type].append(t.score)

    avg_scores = {k: round(sum(v) / len(v)) for k, v in scores_by_type.items() if v}

    # Streak: count consecutive days with completed tasks (backwards from today)
    completed_dates = set()
    for t in task_logs:
        if t.status == "completed" and t.completed_at:
            d = t.completed_at.date() if hasattr(t.completed_at, "date") else t.completed_at
            completed_dates.add(d)

    streak = 0
    check = date.today()
    while check in completed_dates:
        streak += 1
        check -= timedelta(days=1)

    # FlashcardReviewLog recent performance
    fc_logs = db.exec(
        select(FlashcardReviewLog).where(
            FlashcardReviewLog.user_id == user_id,
            FlashcardReviewLog.created_at >= cutoff.isoformat(),
        )
    ).all()
    fc_correct = sum(1 for l in fc_logs if l.rating in ("good", "easy", "mastered"))
    fc_total = len(fc_logs)

    # ListeningSession recent scores
    ls_rows = db.exec(
        select(ListeningSession).where(
            ListeningSession.user_id == user_id,
            ListeningSession.date >= cutoff.isoformat(),
        )
    ).all()
    ls_avg = round(sum(r.score_pct for r in ls_rows) / len(ls_rows)) if ls_rows else None

    # ExamResult recent
    exam_rows = db.exec(
        select(ExamResult).where(
            ExamResult.user_id == user_id,
            ExamResult.date >= cutoff.isoformat(),
        )
    ).all()
    exam_avg = round(sum(r.avg_score for r in exam_rows if r.avg_score) / len(exam_rows)) if exam_rows else None

    if ls_avg is not None:
        avg_scores["listening_module"] = ls_avg
    if fc_total:
        avg_scores["flashcard_module"] = round(fc_correct / fc_total * 100)
    if exam_avg is not None:
        avg_scores["exam_module"] = exam_avg

    return {
        "tasks_completed": completed,
        "tasks_skipped": skipped,
        "avg_scores": avg_scores,
        "streak_days": streak,
    }


def _task_logs_as_dicts(user_id: int, db: Session, days: int = 7) -> list[dict]:
    cutoff = date.today() - timedelta(days=days)
    logs = db.exec(
        select(TaskLog).where(
            TaskLog.user_id == user_id,
            TaskLog.created_at >= cutoff.isoformat(),
        )
    ).all()
    return [
        {
            "task_type": l.task_type,
            "status": l.status,
            "score": l.score,
            "date": l.completed_at.date().isoformat() if l.completed_at else l.created_at.date().isoformat() if hasattr(l.created_at, "date") else str(l.created_at)[:10],
        }
        for l in logs
    ]


def _skill_snapshots_as_dicts(user_id: int, db: Session, days: int = 14) -> list[dict]:
    cutoff = date.today() - timedelta(days=days)
    snaps = db.exec(
        select(SkillSnapshot).where(
            SkillSnapshot.user_id == user_id,
            SkillSnapshot.snapshot_date >= cutoff,
        )
    ).all()
    return [
        {"skill": s.skill, "assessed_level": s.assessed_level, "avg_score": s.avg_score, "date": s.snapshot_date.isoformat()}
        for s in snaps
    ]


# ── Phase 1: Profile + Goal Setup ───────────────────────────────────────────


@router.get("/profile", response_model=ProfileResponse)
def get_profile(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)
    return ProfileResponse(
        language=profile.language,
        planner_enabled=profile.planner_enabled,
        goal=profile.goal,
        timeline_months=profile.timeline_months,
        daily_minutes=profile.daily_minutes,
        current_level=profile.current_level,
        weak_skills=json.loads(profile.weak_skills),
        onboarding_completed=profile.onboarding_completed,
        placement_completed=profile.placement_completed,
        start_date=profile.start_date,
        exam_date=profile.exam_date,
    )


@router.put("/profile", response_model=ProfileResponse)
def update_profile(
    req: ProfileUpdate,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)

    if req.language is not None:
        profile.language = req.language
    if req.goal is not None:
        if req.goal not in ("exam", "everyday", "work"):
            raise HTTPException(status_code=400, detail="Invalid goal. Must be: exam, everyday, work")
        profile.goal = req.goal
    if req.timeline_months is not None:
        if req.timeline_months not in (3, 6, 12):
            raise HTTPException(status_code=400, detail="Invalid timeline. Must be: 3, 6, 12")
        profile.timeline_months = req.timeline_months
    if req.daily_minutes is not None:
        if req.daily_minutes not in (30, 60, 90, 120):
            raise HTTPException(status_code=400, detail="Invalid daily_minutes. Must be: 30, 60, 90, 120")
        profile.daily_minutes = req.daily_minutes
    if req.current_level is not None:
        profile.current_level = req.current_level
    if req.exam_date is not None:
        profile.exam_date = req.exam_date

    # Check if onboarding is complete
    if profile.goal and profile.timeline_months and profile.daily_minutes:
        profile.onboarding_completed = True

    profile.updated_at = datetime.utcnow()
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return ProfileResponse(
        language=profile.language,
        planner_enabled=profile.planner_enabled,
        goal=profile.goal,
        timeline_months=profile.timeline_months,
        daily_minutes=profile.daily_minutes,
        current_level=profile.current_level,
        weak_skills=json.loads(profile.weak_skills),
        onboarding_completed=profile.onboarding_completed,
        placement_completed=profile.placement_completed,
        start_date=profile.start_date,
        exam_date=profile.exam_date,
    )


@router.post("/enable")
def enable_planner(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)
    profile.planner_enabled = True
    if not profile.start_date:
        profile.start_date = date.today()
    profile.updated_at = datetime.utcnow()
    db.add(profile)
    db.commit()
    return {"ok": True, "planner_enabled": True}


@router.post("/disable")
def disable_planner(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)
    profile.planner_enabled = False
    profile.updated_at = datetime.utcnow()
    db.add(profile)
    db.commit()
    return {"ok": True, "planner_enabled": False}


@router.get("/status", response_model=StatusResponse)
def planner_status(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)

    if not profile.planner_enabled:
        return StatusResponse(planner_enabled=False, step="language")

    if not profile.language:
        step = "language"
    elif not profile.goal or not profile.timeline_months or not profile.daily_minutes:
        step = "goal"
    elif not profile.placement_completed:
        step = "placement"
    else:
        step = "ready"

    return StatusResponse(planner_enabled=True, step=step)


# ── Phase 2: Placement Test ─────────────────────────────────────────────────


@router.get("/placement/start")
def placement_start(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)
    questions = generate_placement_questions(language=profile.language)
    return questions


@router.post("/placement/submit", response_model=PlacementSubmitResponse)
def placement_submit(
    req: PlacementSubmitRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)
    questions = req.questions

    # Grade vocab (5 MCQs)
    vocab_qs = questions.get("vocab", [])
    vocab_score = sum(
        1 for q, a in zip(vocab_qs, req.vocab_answers)
        if q.get("answer") == a
    )

    # Grade listening (3 MCQs)
    listening_qs = questions.get("listening", [])
    listening_score = sum(
        1 for q, a in zip(listening_qs, req.listening_answers)
        if q.get("answer") == a
    )

    # Grade reading (3 MCQs)
    reading_qs = questions.get("reading", [])
    reading_score = sum(
        1 for q, a in zip(reading_qs, req.reading_answers)
        if q.get("answer") == a
    )

    # AI-score writing
    writing_result = score_writing(req.writing_text, language=profile.language)
    writing_score = writing_result.get("score", 0)

    # Compute overall level
    scores = {
        "vocab_score": vocab_score,
        "listening_score": listening_score,
        "reading_score": reading_score,
        "writing_score": writing_score,
    }
    overall_level, weak_skills = determine_level(scores)

    # Save PlacementResult (upsert)
    existing = db.exec(
        select(PlacementResult).where(PlacementResult.user_id == user.id)
    ).first()
    if existing:
        existing.vocab_score = vocab_score
        existing.listening_score = listening_score
        existing.reading_score = reading_score
        existing.writing_score = writing_score
        existing.writing_feedback = json.dumps(writing_result)
        existing.overall_level = overall_level
        existing.completed_at = datetime.utcnow()
        db.add(existing)
    else:
        pr = PlacementResult(
            user_id=user.id,
            vocab_score=vocab_score,
            listening_score=listening_score,
            reading_score=reading_score,
            writing_score=writing_score,
            writing_feedback=json.dumps(writing_result),
            overall_level=overall_level,
        )
        db.add(pr)

    # Update profile
    profile.current_level = overall_level
    profile.weak_skills = json.dumps(weak_skills)
    profile.placement_completed = True
    profile.updated_at = datetime.utcnow()
    db.add(profile)
    db.commit()

    return PlacementSubmitResponse(
        vocab_score=vocab_score,
        listening_score=listening_score,
        reading_score=reading_score,
        writing_score=writing_score,
        writing_feedback=writing_result,
        overall_level=overall_level,
        weak_skills=weak_skills,
    )


# ── Phase 3: Daily Task Queue ───────────────────────────────────────────────


@router.get("/today", response_model=DailyPlanResponse)
def get_today_plan(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)
    if not profile.planner_enabled:
        raise HTTPException(status_code=400, detail="Planner is not enabled. Enable it first via POST /planner/enable")

    today = date.today()

    # Check if plan exists for today
    existing_plan = db.exec(
        select(DailyPlan).where(
            DailyPlan.user_id == user.id,
            DailyPlan.plan_date == today,
        )
    ).first()

    if existing_plan:
        return _build_plan_response(existing_plan, db)

    # Generate new plan
    return _generate_and_save_plan(user, profile, today, db)


@router.post("/today/regenerate", response_model=DailyPlanResponse)
def regenerate_today_plan(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)
    if not profile.planner_enabled:
        raise HTTPException(status_code=400, detail="Planner is not enabled.")

    today = date.today()

    # Delete existing plan + task logs for today
    existing_plan = db.exec(
        select(DailyPlan).where(
            DailyPlan.user_id == user.id,
            DailyPlan.plan_date == today,
        )
    ).first()

    if existing_plan:
        # Delete task logs first (FK constraint), then the plan
        task_logs = db.exec(
            select(TaskLog).where(TaskLog.plan_id == existing_plan.id)
        ).all()
        for tl in task_logs:
            db.delete(tl)
        db.flush()  # ensure task logs are deleted before plan
        db.delete(existing_plan)
        db.commit()

    return _generate_and_save_plan(user, profile, today, db)


def _generate_and_save_plan(user: User, profile: UserProfile, plan_date: date, db: Session) -> DailyPlanResponse:
    """Generate AI plan, save to DB, create TaskLog entries, return response."""
    days_since_start = (plan_date - profile.start_date).days if profile.start_date else 0
    recent_perf = _gather_recent_performance(user.id, db)

    # Compute adjustments
    task_log_dicts = _task_logs_as_dicts(user.id, db, days=7)
    snap_dicts = _skill_snapshots_as_dicts(user.id, db, days=14)
    adjustments = compute_adjustments(
        {"goal": profile.goal, "level": profile.current_level},
        task_log_dicts,
        snap_dicts,
    )
    recent_perf["adjustments"] = adjustments

    profile_dict = {
        "goal": profile.goal or "everyday",
        "level": profile.current_level or "A1",
        "timeline_months": profile.timeline_months or 6,
        "daily_minutes": profile.daily_minutes or 30,
        "weak_skills": json.loads(profile.weak_skills),
    }

    retry = False
    try:
        plan_data = generate_daily_plan(
            profile=profile_dict,
            recent_performance=recent_perf,
            days_since_start=days_since_start,
            language=profile.language,
        )
    except Exception:
        # Fallback: use previous day's plan
        yesterday = plan_date - timedelta(days=1)
        prev_plan = db.exec(
            select(DailyPlan).where(
                DailyPlan.user_id == user.id,
                DailyPlan.plan_date == yesterday,
            )
        ).first()
        if prev_plan:
            plan_data = {
                "focus_headline": prev_plan.focus_headline,
                "tasks": json.loads(prev_plan.tasks_json),
                "coach_message": "AI generation failed. Here's yesterday's plan as a fallback.",
                "progress_note": prev_plan.progress_note,
            }
            retry = True
        else:
            # Minimal fallback
            plan_data = {
                "focus_headline": "Daily Practice",
                "tasks": [
                    {"type": "vocab_review", "description": "Review flashcards", "duration_minutes": 15, "difficulty": profile.current_level or "A1"},
                    {"type": "listening_quiz", "description": "Listening exercise", "duration_minutes": 15, "difficulty": profile.current_level or "A1"},
                ],
                "coach_message": "AI is temporarily unavailable. Here's a basic plan to keep you going!",
                "progress_note": "",
            }
            retry = True

    # Save DailyPlan
    dp = DailyPlan(
        user_id=user.id,
        plan_date=plan_date,
        focus_headline=plan_data.get("focus_headline", ""),
        coach_message=plan_data.get("coach_message", ""),
        progress_note=plan_data.get("progress_note", ""),
        tasks_json=json.dumps(plan_data.get("tasks", []), ensure_ascii=False),
    )
    db.add(dp)
    db.commit()
    db.refresh(dp)

    # Create TaskLog entries
    tasks = plan_data.get("tasks", [])
    for i, task in enumerate(tasks):
        tl = TaskLog(
            user_id=user.id,
            plan_id=dp.id,
            task_index=i,
            task_type=task.get("type", ""),
            difficulty=task.get("difficulty"),
        )
        db.add(tl)
    db.commit()

    return _build_plan_response(dp, db, retry=retry)


def _build_plan_response(plan: DailyPlan, db: Session, retry: bool = False) -> DailyPlanResponse:
    """Build DailyPlanResponse from a DailyPlan + its TaskLogs."""
    task_logs = db.exec(
        select(TaskLog).where(TaskLog.plan_id == plan.id).order_by(TaskLog.task_index)
    ).all()

    tasks_data = json.loads(plan.tasks_json)

    task_responses = []
    for tl in task_logs:
        task_data = tasks_data[tl.task_index] if tl.task_index < len(tasks_data) else {}
        task_responses.append(TaskResponse(
            id=tl.id,
            task_index=tl.task_index,
            task_type=tl.task_type,
            description=task_data.get("description", ""),
            duration_minutes=task_data.get("duration_minutes", 0),
            difficulty=tl.difficulty or task_data.get("difficulty", ""),
            status=tl.status,
            score=tl.score,
            time_spent_seconds=tl.time_spent_seconds,
        ))

    return DailyPlanResponse(
        id=plan.id,
        plan_date=plan.plan_date,
        focus_headline=plan.focus_headline,
        coach_message=plan.coach_message,
        progress_note=plan.progress_note,
        tasks=task_responses,
        retry=retry,
    )


@router.post("/tasks/{task_id}/complete")
def complete_task(
    task_id: int,
    req: TaskCompleteRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task_log = db.get(TaskLog, task_id)
    if not task_log or task_log.user_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found")

    task_log.status = "completed"
    task_log.score = req.score
    task_log.time_spent_seconds = req.time_spent_seconds
    task_log.completed_at = datetime.utcnow()
    db.add(task_log)
    db.commit()
    return {"ok": True, "status": "completed"}


@router.post("/tasks/{task_id}/skip")
def skip_task(
    task_id: int,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task_log = db.get(TaskLog, task_id)
    if not task_log or task_log.user_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found")

    task_log.status = "skipped"
    task_log.completed_at = datetime.utcnow()
    db.add(task_log)
    db.commit()
    return {"ok": True, "status": "skipped"}


@router.get("/history", response_model=list[HistoryItem])
def plan_history(
    days: int = 7,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    cutoff = date.today() - timedelta(days=days)
    plans = db.exec(
        select(DailyPlan)
        .where(DailyPlan.user_id == user.id, DailyPlan.plan_date >= cutoff)
        .order_by(DailyPlan.plan_date.desc())
    ).all()

    result = []
    for plan in plans:
        task_logs = db.exec(
            select(TaskLog).where(TaskLog.plan_id == plan.id)
        ).all()
        total = len(task_logs)
        completed = sum(1 for t in task_logs if t.status == "completed")
        result.append(HistoryItem(
            plan_date=plan.plan_date,
            focus_headline=plan.focus_headline,
            total_tasks=total,
            completed_tasks=completed,
            completion_pct=round(completed / total * 100) if total else 0,
        ))
    return result


# ── Phase 5: Weekly Report + Roadmap ────────────────────────────────────────


@router.get("/report/weekly", response_model=WeeklyReportResponse)
def weekly_report(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)

    # Current week boundaries (Monday to Sunday)
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    # Check if report already exists
    existing = db.exec(
        select(WeeklyReport).where(
            WeeklyReport.user_id == user.id,
            WeeklyReport.week_start == week_start,
        )
    ).first()

    if existing:
        return WeeklyReportResponse(
            week_start=existing.week_start,
            week_end=existing.week_end,
            report=json.loads(existing.report_json),
        )

    # Generate new report
    task_log_dicts = _task_logs_as_dicts(user.id, db, days=7)
    snap_dicts = _skill_snapshots_as_dicts(user.id, db, days=7)
    profile_dict = {
        "goal": profile.goal,
        "level": profile.current_level,
    }

    report_data = generate_weekly_report(
        task_logs_7d=task_log_dicts,
        skill_snapshots_7d=snap_dicts,
        profile=profile_dict,
        language=profile.language,
    )

    wr = WeeklyReport(
        user_id=user.id,
        week_start=week_start,
        week_end=week_end,
        report_json=json.dumps(report_data, ensure_ascii=False),
    )
    db.add(wr)
    db.commit()

    return WeeklyReportResponse(
        week_start=week_start,
        week_end=week_end,
        report=report_data,
    )


@router.get("/roadmap", response_model=RoadmapResponse)
def get_roadmap(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    existing = db.exec(
        select(Roadmap).where(Roadmap.user_id == user.id)
    ).first()

    if existing:
        return RoadmapResponse(
            phases=json.loads(existing.phases_json),
            generated_at=existing.generated_at,
        )

    # Auto-generate if placement is done
    profile = _get_or_create_profile(user, db)
    if not profile.placement_completed:
        raise HTTPException(status_code=400, detail="Complete placement test first")

    placement = db.exec(
        select(PlacementResult).where(PlacementResult.user_id == user.id)
    ).first()

    profile_dict = {
        "goal": profile.goal or "everyday",
        "timeline_months": profile.timeline_months or 6,
        "level": profile.current_level or "A1-Low",
        "weak_skills": json.loads(profile.weak_skills),
    }
    placement_dict = {
        "vocab_score": placement.vocab_score if placement else 0,
        "listening_score": placement.listening_score if placement else 0,
        "reading_score": placement.reading_score if placement else 0,
        "writing_score": placement.writing_score if placement else 0,
        "overall_level": placement.overall_level if placement else "A1-Low",
    }

    roadmap_data = generate_roadmap(
        profile=profile_dict,
        placement_result=placement_dict,
        language=profile.language,
    )

    phases = roadmap_data.get("phases", [])
    rm = Roadmap(
        user_id=user.id,
        phases_json=json.dumps(phases, ensure_ascii=False),
    )
    db.add(rm)
    db.commit()
    db.refresh(rm)

    return RoadmapResponse(phases=phases, generated_at=rm.generated_at)


@router.post("/roadmap/regenerate", response_model=RoadmapResponse)
def regenerate_roadmap(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(user, db)
    if not profile.placement_completed:
        raise HTTPException(status_code=400, detail="Complete placement test first")

    # Delete existing
    existing = db.exec(
        select(Roadmap).where(Roadmap.user_id == user.id)
    ).first()
    if existing:
        db.delete(existing)
        db.commit()

    placement = db.exec(
        select(PlacementResult).where(PlacementResult.user_id == user.id)
    ).first()

    profile_dict = {
        "goal": profile.goal or "everyday",
        "timeline_months": profile.timeline_months or 6,
        "level": profile.current_level or "A1-Low",
        "weak_skills": json.loads(profile.weak_skills),
    }
    placement_dict = {
        "vocab_score": placement.vocab_score if placement else 0,
        "listening_score": placement.listening_score if placement else 0,
        "reading_score": placement.reading_score if placement else 0,
        "writing_score": placement.writing_score if placement else 0,
        "overall_level": placement.overall_level if placement else "A1-Low",
    }

    roadmap_data = generate_roadmap(
        profile=profile_dict,
        placement_result=placement_dict,
        language=profile.language,
    )

    phases = roadmap_data.get("phases", [])
    rm = Roadmap(
        user_id=user.id,
        phases_json=json.dumps(phases, ensure_ascii=False),
    )
    db.add(rm)
    db.commit()
    db.refresh(rm)

    return RoadmapResponse(phases=phases, generated_at=rm.generated_at)
