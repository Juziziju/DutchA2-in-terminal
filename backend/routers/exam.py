"""Mock exam router — session creation and per-section result submission."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

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


class ExamSessionOut(BaseModel):
    sections: list[SectionInfo]
    pass_score: int


@router.get("/session", response_model=ExamSessionOut)
def get_exam_session(_user: User = Depends(get_current_user)):
    sections = [
        SectionInfo(code=code, label=SECTION_LABELS[code], default_minutes=minutes)
        for code, minutes in SECTION_DEFAULTS.items()
    ]
    return ExamSessionOut(sections=sections, pass_score=PASS_SCORE)


class SectionResultRequest(BaseModel):
    source: str  # "official" | "ai"
    scores: dict[str, int | None]  # section_code → score (0–100) or None if skipped


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
