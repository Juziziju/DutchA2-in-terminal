"""Listening router — generate dialogue + audio, submit answers."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.core.audio import generate_dialogue_audio, new_session_prefix
from backend.core.qwen import generate_dialogue, generate_intensive, get_explanation
from backend.database import get_session
from backend.models.listening import ListeningSession
from backend.models.user import User
from backend.models.vocab import Vocab
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/listening", tags=["listening"])


class DialogueLine(BaseModel):
    speaker: str
    text: str
    english: str
    audio_file: str | None  # relative to /audio_listening/


class Question(BaseModel):
    question: str
    options: dict[str, str]
    answer: str


class GenerateRequest(BaseModel):
    mode: str = "quiz"   # "quiz" | "intensive"
    level: str = "A2"    # "A1" | "A2" | "B1"


class GenerateResponse(BaseModel):
    session_id: str  # prefix used for audio files
    topic: str
    speakers: list[str]
    dialogue: list[DialogueLine]
    questions: list[Question]
    vocab_used: list[str]
    level: str


@router.post("/generate", response_model=GenerateResponse)
def generate(
    req: GenerateRequest | None = None,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    body = req or GenerateRequest()
    level = body.level if body.level in ("A1", "A2", "B1") else "A2"

    vocab_words = [v.dutch for v in db.exec(select(Vocab)).all() if v.dutch]
    if len(vocab_words) < 5:
        raise HTTPException(
            status_code=400,
            detail="Not enough vocab in the database. Run /vocab/sync first.",
        )

    data, sample = generate_dialogue(vocab_words, level=level)
    session_prefix = new_session_prefix()
    audio_filenames = generate_dialogue_audio(data["dialogue"], session_prefix)

    lines = []
    for line, audio_file in zip(data["dialogue"], audio_filenames):
        lines.append(DialogueLine(
            speaker=line["speaker"],
            text=line["text"],
            english=line["english"],
            audio_file=audio_file,
        ))

    return GenerateResponse(
        session_id=session_prefix,
        topic=data["topic"],
        speakers=data["speakers"],
        dialogue=lines,
        questions=[Question(**q) for q in data["questions"]],
        vocab_used=sample,
        level=level,
    )


class SubmitRequest(BaseModel):
    session_id: str
    topic: str
    dialogue: list[dict]
    questions: list[dict]
    user_answers: list[str]
    vocab_used: list[str]
    mode: str = "quiz"
    level: str = "A2"
    duration_seconds: int | None = None


class SubmitResponse(BaseModel):
    score: int
    total: int
    score_pct: int
    correct: list[bool]
    explanation: str | None


@router.post("/submit", response_model=SubmitResponse)
def submit(
    req: SubmitRequest,
    include_explanation: bool = False,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    questions = req.questions
    user_answers = req.user_answers

    if len(user_answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answer count mismatch.")

    correct = [ua == q["answer"] for ua, q in zip(user_answers, questions)]
    score = sum(correct)
    total = len(questions)
    score_pct = round(score / total * 100)

    log_data = {
        "date": datetime.utcnow().isoformat(timespec="seconds"),
        "topic": req.topic,
        "mode": req.mode,
        "level": req.level,
        "vocab_used": req.vocab_used,
        "dialogue": req.dialogue,
        "questions": [
            {**q, "user_answer": ua, "correct": ua == q["answer"]}
            for q, ua in zip(questions, user_answers)
        ],
        "score": score,
        "total": total,
        "percentage": score_pct,
    }

    ls = ListeningSession(
        user_id=user.id,
        topic=req.topic,
        score_pct=score_pct,
        mode=req.mode,
        level=req.level,
        duration_seconds=req.duration_seconds,
        log_json=json.dumps(log_data, ensure_ascii=False),
    )
    db.add(ls)
    db.commit()

    explanation = None
    if include_explanation:
        try:
            explanation = get_explanation(
                {"topic": req.topic, "dialogue": req.dialogue},
                questions,
                user_answers,
            )
        except Exception as e:
            explanation = f"Could not generate explanation: {e}"

    return SubmitResponse(
        score=score,
        total=total,
        score_pct=score_pct,
        correct=correct,
        explanation=explanation,
    )


class ExplainRequest(BaseModel):
    topic: str
    dialogue: list[dict]
    questions: list[dict]
    user_answers: list[str]
    level: str = "A2"


@router.post("/explain")
def explain(
    req: ExplainRequest,
    _user: User = Depends(get_current_user),
):
    try:
        text = get_explanation(
            {"topic": req.topic, "dialogue": req.dialogue},
            req.questions,
            req.user_answers,
            level=req.level,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"explanation": text}


# ── Intensive listening ──────────────────────────────────────────────────────

class IntensiveLine(BaseModel):
    speaker: str
    text: str
    english: str
    audio_file: str | None


class GenerateIntensiveRequest(BaseModel):
    level: str = "A2"
    content_type: str = "dialogue"  # "dialogue" | "news" | "article"


class GenerateIntensiveResponse(BaseModel):
    session_id: str
    topic: str
    speakers: list[str]
    lines: list[IntensiveLine]
    vocab_used: list[str]
    level: str
    content_type: str


@router.post("/generate-intensive", response_model=GenerateIntensiveResponse)
def generate_intensive_endpoint(
    req: GenerateIntensiveRequest | None = None,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    body = req or GenerateIntensiveRequest()
    level = body.level if body.level in ("A1", "A2", "B1") else "A2"
    content_type = body.content_type if body.content_type in ("dialogue", "news", "article") else "dialogue"

    vocab_words = [v.dutch for v in db.exec(select(Vocab)).all() if v.dutch]
    if len(vocab_words) < 5:
        raise HTTPException(status_code=400, detail="Not enough vocab in the database.")

    data, sample = generate_intensive(vocab_words, level=level, content_type=content_type)
    session_prefix = new_session_prefix()
    audio_filenames = generate_dialogue_audio(data["lines"], session_prefix)

    lines = []
    for line, audio_file in zip(data["lines"], audio_filenames):
        lines.append(IntensiveLine(
            speaker=line["speaker"],
            text=line["text"],
            english=line["english"],
            audio_file=audio_file,
        ))

    return GenerateIntensiveResponse(
        session_id=session_prefix,
        topic=data["topic"],
        speakers=data["speakers"],
        lines=lines,
        vocab_used=sample,
        level=level,
        content_type=content_type,
    )


class SubmitIntensiveRequest(BaseModel):
    session_id: str
    topic: str
    lines: list[dict]       # original lines with audio_file
    user_texts: list[str]   # user typed texts per line
    vocab_used: list[str]
    level: str = "A2"
    content_type: str = "dialogue"
    duration_seconds: int | None = None


class IntensiveLineResult(BaseModel):
    original: str
    user_text: str
    correct: bool
    audio_file: str | None


class SubmitIntensiveResponse(BaseModel):
    score_pct: int
    results: list[IntensiveLineResult]


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation for comparison."""
    import re
    return re.sub(r"[^\w\s]", "", text.lower()).strip()


@router.post("/submit-intensive", response_model=SubmitIntensiveResponse)
def submit_intensive(
    req: SubmitIntensiveRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    lines = req.lines
    user_texts = req.user_texts

    if len(user_texts) != len(lines):
        raise HTTPException(status_code=400, detail="Line count mismatch.")

    results = []
    correct_count = 0
    for line, ut in zip(lines, user_texts):
        orig = line.get("text", "")
        is_correct = _normalize(orig) == _normalize(ut)
        if is_correct:
            correct_count += 1
        results.append(IntensiveLineResult(
            original=orig,
            user_text=ut,
            correct=is_correct,
            audio_file=line.get("audio_file"),
        ))

    score_pct = round(correct_count / len(lines) * 100) if lines else 0

    log_data = {
        "date": datetime.utcnow().isoformat(timespec="seconds"),
        "topic": req.topic,
        "mode": "intensive",
        "level": req.level,
        "content_type": req.content_type,
        "vocab_used": req.vocab_used,
        "lines": req.lines,
        "user_texts": req.user_texts,
        "results": [r.model_dump() for r in results],
        "score_pct": score_pct,
    }

    ls = ListeningSession(
        user_id=user.id,
        topic=req.topic,
        score_pct=score_pct,
        mode="intensive",
        level=req.level,
        content_type=req.content_type,
        duration_seconds=req.duration_seconds,
        log_json=json.dumps(log_data, ensure_ascii=False),
    )
    db.add(ls)
    db.commit()

    return SubmitIntensiveResponse(score_pct=score_pct, results=results)
