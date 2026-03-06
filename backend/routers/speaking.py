"""Speaking router — scene content, recording upload, AI review."""

import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select, col

from backend.config import AUDIO_SPEAKING_DIR
from backend.core.audio import new_session_prefix
from backend.core.speaking_ai import review_shadow, review_speaking, transcribe_audio
from backend.core.speaking_bank import (
    SPEAKING_SCENES,
    get_mock_exam,
    get_mock_exam_list,
    get_mock_question,
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
    """Return all scenes (built-in + custom) with unlock status and average scores."""
    from backend.models.custom_scene import CustomScene

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
            "is_custom": False,
        })

    # Append user's custom scenes
    custom = db.exec(
        select(CustomScene).where(CustomScene.user_id == user.id).order_by(col(CustomScene.created_at).desc())
    ).all()
    for cs in custom:
        scores = completed_scenes.get(cs.scene_id, [])
        avg_score = round(sum(scores) / len(scores)) if scores else None
        result.append({
            "id": cs.scene_id,
            "title_en": cs.title_en,
            "title_nl": cs.title_nl,
            "order": 100,
            "vocab_count": len(json.loads(cs.vocab_json)),
            "sentence_count": len(json.loads(cs.sentences_json)),
            "question_count": sum(len(v) for v in json.loads(cs.questions_json).values()),
            "unlocked": True,
            "attempts": len(scores),
            "avg_score": avg_score,
            "is_custom": True,
            "level": cs.level,
        })
    return result


def _find_custom_scene(scene_id: str, user_id: int, db: Session):
    """Look up a custom scene from DB, return as dict or None."""
    from backend.models.custom_scene import CustomScene
    cs = db.exec(
        select(CustomScene).where(CustomScene.scene_id == scene_id, CustomScene.user_id == user_id)
    ).first()
    if not cs:
        return None
    return {
        "id": cs.scene_id,
        "title_en": cs.title_en,
        "title_nl": cs.title_nl,
        "vocab": json.loads(cs.vocab_json),
        "model_sentences": json.loads(cs.sentences_json),
        "exam_questions": json.loads(cs.questions_json),
    }


@router.get("/scenes/{scene_id}")
def scene_detail(
    scene_id: str,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return full scene content (vocab + model sentences)."""
    scene = get_scene(scene_id) or _find_custom_scene(scene_id, user.id, db)
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
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return exam questions for a scene."""
    scene = get_scene(scene_id) or _find_custom_scene(scene_id, user.id, db)
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
    # Validate question exists — check mock exams, built-in scenes, then custom scenes
    question = get_mock_question(scene, question_id) or get_question(scene, question_id)
    if not question:
        # Check custom scenes
        custom = _find_custom_scene(scene, user.id, db)
        if custom:
            for qtype in ("short", "long"):
                for q in custom["exam_questions"].get(qtype, []):
                    if q["id"] == question_id:
                        question = q
                        break
                if question:
                    break
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


# ── Shadow reading submission ─────────────────────────────────────────────────


class SubmitShadowResponse(BaseModel):
    session_id: int
    transcript: str
    similarity_score: int
    word_matches: list[str]
    word_misses: list[str]
    feedback: str
    original_sentence: str


@router.post("/submit-shadow", response_model=SubmitShadowResponse)
async def submit_shadow(
    audio: UploadFile = File(...),
    scene_id: str = Form(...),
    sentence_index: int = Form(...),
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Upload shadow-reading recording → STT → compare to original sentence."""
    scene = get_scene(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    sentences = scene["model_sentences"]
    if sentence_index < 0 or sentence_index >= len(sentences):
        raise HTTPException(status_code=404, detail="Sentence not found")

    original_sentence = sentences[sentence_index]["text"]

    # Save audio file
    AUDIO_SPEAKING_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    ext = Path(audio.filename or "recording.webm").suffix or ".webm"
    filename = f"{user.id}_shadow_{timestamp}{ext}"
    audio_path = AUDIO_SPEAKING_DIR / filename

    content = await audio.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file too large (max 5MB)")
    if len(content) < 1000:
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

    # AI comparison
    try:
        result = review_shadow(transcript=transcript, original_sentence=original_sentence)
    except Exception as e:
        result = {
            "similarity_score": 0,
            "word_matches": [],
            "word_misses": original_sentence.split(),
            "feedback": f"AI review failed: {e}",
        }

    # Save to DB
    session_record = SpeakingSession(
        user_id=user.id,
        scene=scene_id,
        question_id=f"shadow_{sentence_index}",
        question_type="shadow",
        mode="shadow_reading",
        audio_file=filename,
        transcript=transcript,
        feedback_json=json.dumps(result, ensure_ascii=False),
        score_pct=result.get("similarity_score", 0),
        date=datetime.utcnow(),
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    return SubmitShadowResponse(
        session_id=session_record.id,
        transcript=transcript,
        similarity_score=result.get("similarity_score", 0),
        word_matches=result.get("word_matches", []),
        word_misses=result.get("word_misses", []),
        feedback=result.get("feedback", ""),
        original_sentence=original_sentence,
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


# ── Mock exam endpoints ──────────────────────────────────────────────────────


@router.get("/mock-exams")
def list_mock_exams(
    _user: User = Depends(get_current_user),
):
    """Return available mock exam sets."""
    return get_mock_exam_list()


@router.get("/mock-exams/{exam_id}")
def mock_exam_detail(
    exam_id: str,
    _user: User = Depends(get_current_user),
):
    """Return full mock exam with all questions."""
    exam = get_mock_exam(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Mock exam not found")
    return exam


# ── TTS for model sentences ─────────────────────────────────────────────────


@router.get("/tts/{scene_id}/{sentence_index}")
def get_sentence_audio(
    scene_id: str,
    sentence_index: int,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Generate TTS for a model sentence and return the audio file path."""
    scene = get_scene(scene_id) or _find_custom_scene(scene_id, user.id, db)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    sentences = scene["model_sentences"]
    if sentence_index < 0 or sentence_index >= len(sentences):
        raise HTTPException(status_code=404, detail="Sentence not found")

    from backend.config import AUDIO_LISTENING_DIR
    from backend.core.audio import _generate_edge_tts, VOICE_FEMALE_1
    from backend.core.storage import upload_file

    text = sentences[sentence_index]["text"]
    filename = f"speaking_{scene_id}_{sentence_index:02d}.mp3"
    path = AUDIO_LISTENING_DIR / filename
    if not path.exists():
        AUDIO_LISTENING_DIR.mkdir(parents=True, exist_ok=True)
        _generate_edge_tts(text, path, voice=VOICE_FEMALE_1)
        try:
            with open(path, "rb") as f:
                upload_file("listening", filename, f.read())
        except Exception:
            pass

    return {"audio_file": filename}


# ── Custom scene generation ─────────────────────────────────────────────────


class CreateSceneRequest(BaseModel):
    topic: str
    level: str = "A2"
    admin_password: str = ""


class CreateSceneResponse(BaseModel):
    scene_id: str
    title_en: str
    title_nl: str


MAX_CUSTOM_SCENES = 5


@router.post("/custom-scenes", response_model=CreateSceneResponse)
def create_custom_scene(
    req: CreateSceneRequest,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Generate a custom speaking scene from a topic. Limited to 5 per user."""
    from backend.core.qwen import generate_custom_scene
    from backend.models.custom_scene import CustomScene

    # Check limit (admin bypasses)
    bypass = False
    if user.username == "admin":
        bypass = True
    elif req.admin_password:
        from backend.core.auth import verify_password
        admin = db.exec(select(User).where(User.username == "admin")).first()
        if admin and verify_password(req.admin_password, admin.hashed_password):
            bypass = True

    if not bypass:
        count = len(db.exec(
            select(CustomScene).where(CustomScene.user_id == user.id)
        ).all())
        if count >= MAX_CUSTOM_SCENES:
            raise HTTPException(
                status_code=403,
                detail=f"Custom scene limit reached ({MAX_CUSTOM_SCENES}). Contact admin for more.",
            )

    data = generate_custom_scene(req.topic, req.level)
    scene_id = f"custom_{user.id}_{int(datetime.utcnow().timestamp())}"

    cs = CustomScene(
        user_id=user.id,
        scene_id=scene_id,
        title_en=data["title_en"],
        title_nl=data["title_nl"],
        level=req.level,
        vocab_json=json.dumps(data["vocab"]),
        sentences_json=json.dumps(data["model_sentences"]),
        questions_json=json.dumps(data.get("exam_questions", {"short": [], "long": []})),
    )
    db.add(cs)
    db.commit()
    db.refresh(cs)

    return CreateSceneResponse(scene_id=scene_id, title_en=data["title_en"], title_nl=data["title_nl"])


@router.get("/custom-scenes")
def list_custom_scenes(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List all custom scenes for this user."""
    from backend.models.custom_scene import CustomScene

    scenes = db.exec(
        select(CustomScene).where(CustomScene.user_id == user.id).order_by(col(CustomScene.created_at).desc())
    ).all()
    return [
        {
            "id": s.scene_id,
            "title_en": s.title_en,
            "title_nl": s.title_nl,
            "level": s.level,
            "vocab_count": len(json.loads(s.vocab_json)),
            "sentence_count": len(json.loads(s.sentences_json)),
            "question_count": sum(len(v) for v in json.loads(s.questions_json).values()),
            "created_at": s.created_at.isoformat(),
        }
        for s in scenes
    ]


@router.get("/custom-scenes/{scene_id}")
def custom_scene_detail(
    scene_id: str,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return full custom scene content."""
    from backend.models.custom_scene import CustomScene

    cs = db.exec(
        select(CustomScene).where(CustomScene.scene_id == scene_id, CustomScene.user_id == user.id)
    ).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Custom scene not found")
    return {
        "id": cs.scene_id,
        "title_en": cs.title_en,
        "title_nl": cs.title_nl,
        "level": cs.level,
        "vocab": json.loads(cs.vocab_json),
        "model_sentences": json.loads(cs.sentences_json),
    }


@router.get("/custom-scenes/{scene_id}/questions")
def custom_scene_questions(
    scene_id: str,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Return exam questions for a custom scene."""
    from backend.models.custom_scene import CustomScene

    cs = db.exec(
        select(CustomScene).where(CustomScene.scene_id == scene_id, CustomScene.user_id == user.id)
    ).first()
    if not cs:
        raise HTTPException(status_code=404, detail="Custom scene not found")
    return json.loads(cs.questions_json)
