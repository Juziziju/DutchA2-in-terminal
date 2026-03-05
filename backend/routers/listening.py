"""Listening router — generate dialogue + audio, submit answers."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.core.audio import generate_dialogue_audio, new_session_prefix
from backend.core.qwen import generate_dialogue, get_explanation
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


class GenerateResponse(BaseModel):
    session_id: str  # prefix used for audio files
    topic: str
    speakers: list[str]
    dialogue: list[DialogueLine]
    questions: list[Question]
    vocab_used: list[str]


@router.post("/generate", response_model=GenerateResponse)
def generate(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    vocab_words = [v.dutch for v in db.exec(select(Vocab)).all() if v.dutch]
    if len(vocab_words) < 5:
        raise HTTPException(
            status_code=400,
            detail="Not enough vocab in the database. Run /vocab/sync first.",
        )

    data, sample = generate_dialogue(vocab_words)
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
    )


class SubmitRequest(BaseModel):
    session_id: str
    topic: str
    dialogue: list[dict]
    questions: list[dict]
    user_answers: list[str]
    vocab_used: list[str]


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
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"explanation": text}
