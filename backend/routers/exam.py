"""Mock exam router — serve questions from exam bank, grade answers."""

import json
import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from backend.core.exam_bank import EXAM_BANK
from backend.database import get_session
from backend.models.exam import ExamResult
from backend.models.user import User
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/exam", tags=["exam"])

SECTION_DEFAULTS = {
    "LZ":  35,
    "LU":  30,
    "SC":  45,
    "SP":  15,
    "KNM": 40,
}

SECTION_LABELS = {
    "LZ":  "Lezen (Reading)",
    "LU":  "Luisteren (Listening)",
    "SC":  "Schrijven (Writing)",
    "SP":  "Spreken (Speaking)",
    "KNM": "KNM (Society)",
}

PASS_SCORE = 60


class SectionInfo(BaseModel):
    code: str
    label: str
    default_minutes: int
    question_count: int


class ExamSessionOut(BaseModel):
    sections: list[SectionInfo]
    pass_score: int


@router.get("/session", response_model=ExamSessionOut)
def get_exam_session(_user: User = Depends(get_current_user)):
    sections = [
        SectionInfo(
            code=code,
            label=SECTION_LABELS[code],
            default_minutes=minutes,
            question_count=len(EXAM_BANK.get(code, [])),
        )
        for code, minutes in SECTION_DEFAULTS.items()
    ]
    return ExamSessionOut(sections=sections, pass_score=PASS_SCORE)


class ExamQuestion(BaseModel):
    id: str
    section: str
    # For LZ
    text_nl: str | None = None
    text_en: str | None = None
    # For LU
    scenario_nl: str | None = None
    scenario_en: str | None = None
    # For SC
    prompt_nl: str | None = None
    prompt_en: str | None = None
    task_nl: str | None = None
    task_en: str | None = None
    model_answer: str | None = None
    key_points: list[str] | None = None
    # For SP
    situation_nl: str | None = None
    situation_en: str | None = None
    expected_phrases: list[str] | None = None
    # Common MC fields
    question_nl: str | None = None
    question_en: str | None = None
    options: dict[str, str] | None = None
    # Never send answer in question response
    explanation_en: str | None = None


@router.get("/questions/{section_code}", response_model=list[ExamQuestion])
def get_section_questions(
    section_code: str,
    _user: User = Depends(get_current_user),
):
    if section_code not in EXAM_BANK:
        raise HTTPException(status_code=404, detail=f"Unknown section: {section_code}")

    questions = EXAM_BANK[section_code]
    result = []
    for q in questions:
        eq = ExamQuestion(id=q["id"], section=section_code, **{
            k: v for k, v in q.items()
            if k not in ("id", "answer", "explanation_en")
        })
        result.append(eq)
    return result


class AnswerItem(BaseModel):
    question_id: str
    answer: str  # For MC: "A"/"B"/etc. For SC/SP: free text


class GradedItem(BaseModel):
    question_id: str
    correct: bool
    user_answer: str
    correct_answer: str | None = None
    explanation: str | None = None


class SectionGradeOut(BaseModel):
    section: str
    score: int
    total: int
    score_pct: int
    items: list[GradedItem]


@router.post("/grade/{section_code}", response_model=SectionGradeOut)
def grade_section(
    section_code: str,
    answers: list[AnswerItem],
    _user: User = Depends(get_current_user),
):
    if section_code not in EXAM_BANK:
        raise HTTPException(status_code=404, detail=f"Unknown section: {section_code}")

    bank = {q["id"]: q for q in EXAM_BANK[section_code]}
    items = []
    correct_count = 0

    for a in answers:
        q = bank.get(a.question_id)
        if not q:
            items.append(GradedItem(
                question_id=a.question_id,
                correct=False,
                user_answer=a.answer,
                correct_answer=None,
                explanation="Question not found",
            ))
            continue

        if "answer" in q:
            # MC grading
            is_correct = a.answer.strip().upper() == q["answer"].strip().upper()
            items.append(GradedItem(
                question_id=a.question_id,
                correct=is_correct,
                user_answer=a.answer,
                correct_answer=q["answer"],
                explanation=q.get("explanation_en"),
            ))
            if is_correct:
                correct_count += 1
        else:
            # SC/SP — auto-pass for now (user self-grades)
            items.append(GradedItem(
                question_id=a.question_id,
                correct=True,
                user_answer=a.answer,
                correct_answer=q.get("model_answer"),
                explanation=None,
            ))
            correct_count += 1

    total = len(answers) if answers else 1
    score_pct = round(correct_count / total * 100)

    return SectionGradeOut(
        section=section_code,
        score=correct_count,
        total=total,
        score_pct=score_pct,
        items=items,
    )


class SectionResultRequest(BaseModel):
    source: str  # "official" | "ai"
    scores: dict[str, int | None]  # section_code -> score (0-100) or None if skipped


class ExamResultOut(BaseModel):
    id: int
    date: str
    source: str
    scores: dict[str, int | None]
    avg_score: int | None
    passed: bool


@router.post("/submit", response_model=ExamResultOut)
def submit_exam(
    req: SectionResultRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if req.source not in ("official", "ai"):
        raise HTTPException(status_code=400, detail="source must be 'official' or 'ai'")

    done = [v for v in req.scores.values() if v is not None]
    avg = (sum(done) // len(done)) if done else None
    all_passed = all(v >= PASS_SCORE for v in done) if done else False

    result = ExamResult(
        user_id=user.id,
        source=req.source,
        scores_json=json.dumps(req.scores),
        avg_score=avg,
        passed=all_passed,
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    return ExamResultOut(
        id=result.id,
        date=result.date.isoformat(timespec="seconds"),
        source=result.source,
        scores=req.scores,
        avg_score=avg,
        passed=all_passed,
    )
