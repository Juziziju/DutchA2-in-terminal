"""Freestyle Talk router — SSE endpoint for conversational Dutch AI."""

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from backend.config import AUDIO_SPEAKING_DIR
from backend.core.freestyle_ai import stream_freestyle_response
from backend.core.speaking_ai import transcribe_audio
from backend.database import get_session
from backend.models.user import User
from backend.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/speaking/freestyle", tags=["freestyle"])


@router.post("/chat")
def freestyle_chat(
    audio: UploadFile = File(...),
    history: str = Form("[]"),
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    1. Save uploaded audio
    2. Transcribe with STT
    3. Stream SSE: transcript event -> sentence events -> done event
    """
    # Save audio
    AUDIO_SPEAKING_DIR.mkdir(parents=True, exist_ok=True)
    audio_filename = f"freestyle_{user.id}_{uuid.uuid4().hex[:8]}.webm"
    audio_path = AUDIO_SPEAKING_DIR / audio_filename
    with open(audio_path, "wb") as f:
        f.write(audio.file.read())

    # Transcribe
    try:
        transcript = transcribe_audio(audio_path)
    except Exception as e:
        logger.exception("STT transcription failed")
        raise HTTPException(status_code=503, detail=f"Speech-to-text failed: {e}")

    if not transcript or not transcript.strip():
        raise HTTPException(status_code=400, detail="No speech detected in the audio.")

    # Parse history
    try:
        conversation_history = json.loads(history)
    except json.JSONDecodeError:
        conversation_history = []

    session_prefix = f"freestyle_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def generate():
        # First: send transcript
        yield f"data: {json.dumps({'type': 'transcript', 'text': transcript})}\n\n"

        # Stream LLM sentences
        try:
            for event in stream_freestyle_response(
                conversation_history, transcript, session_prefix
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.exception("Freestyle streaming failed")
            yield f"data: {json.dumps({'type': 'error', 'message': f'Response generation failed: {e}'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
