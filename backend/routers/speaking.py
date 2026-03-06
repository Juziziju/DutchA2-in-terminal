"""Speaking router — scene content, recording upload, AI review."""

import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select, col

from backend.config import AUDIO_SPEAKING_DIR
from backend.core.audio import new_session_prefix
from backend.core.speaking_ai import review_speaking, transcribe_audio
from backend.core.speaking_bank import (
    SPEAKING_SCENES,
    get_question,
    get_scene,
    get_scene_list,
)
from backend.database import get_session
from backend.models.speaking import SpeakingSession
from backend.models.user import User
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/speaking", tags=["speaking"])


# ── Scene endpoints (Block 1) ────────────────────────────────────────────────


@router.get("/scenes")
def list_scenes(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return all scenes with unlock status and average scores."""
    scenes = get_scene_list()
    # Get user's completed scene sessions
    user_sessions = db.exec(
        select(SpeakingSession).where(SpeakingSession.user_id == user.id)
    ).all()

    completed_scenes: dict[str, list[int]] = {}
    for s in user_sessions:
        completed_scenes.setdefault(s.scene, [])
        if s.score_pct is not None:
            completed_scenes[s.scene].append(s.score_pct)

    result = []
    for i, scene in enumerate(scenes):
        # Scene 0 always unlocked; others require previous scene to have at least 1 session
        if i == 0:
            unlocked = True
        else:
            prev_id = scenes[i - 1]["id"]
            unlocked = prev_id in completed_scenes and len(completed_scenes[prev_id]) > 0

        scores = completed_scenes.get(scene["id"], [])
        avg_score = round(sum(scores) / len(scores)) if scores else None

        result.append({
            **scene,
            "unlocked": unlocked,
            "attempts": len(scores),
            "avg_score": avg_score,
        })
    return result


@router.get("/scenes/{scene_id}")
def scene_detail(
    scene_id: str,
    _user: User = Depends(get_current_user),
):
    """Return full scene content (vocab + model sentences)."""
    scene = get_scene(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return {
        "id": scene["id"],
        "title_en": scene["title_en"],
        "title_nl": scene["title_nl"],
        "vocab": scene["vocab"],
        "model_sentences": scene["model_sentences"],
    }


@router.get("/scenes/{scene_id}/questions")
def scene_questions(
    scene_id: str,
    _user: User = Depends(get_current_user),
):
    """Return exam questions for a scene."""
    scene = get_scene(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene["exam_questions"]


# ── Recording submission (Block 2 + 3) ───────────────────────────────────────


class SubmitRecordingResponse(BaseModel):
    session_id: int
    transcript: str
    feedback: dict
    score_pct: int
    model_answer: str


@router.post("/submit-recording", response_model=SubmitRecordingResponse)
async def submit_recording(
    audio: UploadFile = File(...),
    scene: str = Form(...),
    question_id: str = Form(...),
    question_type: str = Form("short"),
    mode: str = Form("scene_drill"),
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Upload recording → STT → AI review → save + return feedback."""
    # Validate question exists
    question = get_question(scene, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Save audio file
    AUDIO_SPEAKING_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    ext = Path(audio.filename or "recording.webm").suffix or ".webm"
    filename = f"{user.id}_{timestamp}{ext}"
    audio_path = AUDIO_SPEAKING_DIR / filename

    content = await audio.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=413, detail="Audio file too large (max 5MB)")
    if len(content) < 1000:  # ~1KB minimum
        raise HTTPException(status_code=400, detail="Recording too short")

    with open(audio_path, "wb") as f:
        f.write(content)

    # STT transcription
    try:
        transcript = transcribe_audio(audio_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    if not transcript.strip():
        transcript = "(no speech detected)"

    # AI review
    try:
        feedback = review_speaking(
            transcript=transcript,
            prompt_nl=question["prompt_nl"],
            prompt_en=question["prompt_en"],
            expected_phrases=question["expected_phrases"],
            model_answer=question["model_answer"],
            question_type=question["question_type"],
        )
    except Exception as e:
        feedback = {
            "score": 0,
            "vocabulary_score": 0,
            "grammar_score": 0,
            "completeness_score": 0,
            "matched_phrases": [],
            "missing_phrases": question["expected_phrases"],
            "grammar_errors": [],
            "feedback_en": f"AI review failed: {e}",
            "improved_answer": question["model_answer"],
        }

    score_pct = feedback.get("score", 0)

    # Save to DB
    session_record = SpeakingSession(
        user_id=user.id,
        scene=scene,
        question_id=question_id,
        question_type=question["question_type"],
        mode=mode,
        audio_file=filename,
        transcript=transcript,
        feedback_json=json.dumps(feedback, ensure_ascii=False),
        score_pct=score_pct,
        date=datetime.utcnow(),
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    return SubmitRecordingResponse(
        session_id=session_record.id,
        transcript=transcript,
        feedback=feedback,
        score_pct=score_pct,
        model_answer=question["model_answer"],
    )


# ── History ──────────────────────────────────────────────────────────────────


@router.get("/history")
def speaking_history(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return user's speaking practice history."""
    sessions = db.exec(
        select(SpeakingSession)
        .where(SpeakingSession.user_id == user.id)
        .order_by(col(SpeakingSession.date).desc())
        .limit(50)
    ).all()

    return [
        {
            "id": s.id,
            "scene": s.scene,
            "question_id": s.question_id,
            "question_type": s.question_type,
            "mode": s.mode,
            "transcript": s.transcript,
            "score_pct": s.score_pct,
            "date": s.date.isoformat(),
            "feedback": json.loads(s.feedback_json) if s.feedback_json else {},
        }
        for s in sessions
    ]


# ── TTS for model sentences ─────────────────────────────────────────────────


@router.get("/tts/{scene_id}/{sentence_index}")
def get_sentence_audio(
    scene_id: str,
    sentence_index: int,
    _user: User = Depends(get_current_user),
):
    """Generate TTS for a model sentence and return the audio file path."""
    scene = get_scene(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    sentences = scene["model_sentences"]
    if sentence_index < 0 or sentence_index >= len(sentences):
        raise HTTPException(status_code=404, detail="Sentence not found")

    from backend.core.audio import AUDIO_LISTENING_DIR, _generate_mp3

    text = sentences[sentence_index]["text"]
    filename = f"speaking_{scene_id}_{sentence_index:02d}.mp3"
    path = AUDIO_LISTENING_DIR / filename
    if not path.exists():
        AUDIO_LISTENING_DIR.mkdir(parents=True, exist_ok=True)
        _generate_mp3(text, path, lang="nl")

    return {"audio_file": filename}
