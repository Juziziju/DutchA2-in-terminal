"""Freestyle Talk — streaming LLM + sentence-level TTS pipeline."""

import re
from datetime import datetime
from pathlib import Path
from typing import Generator

from backend.config import AI_API_KEY, AI_BASE_URL, AI_MODEL, AUDIO_SPEAKING_DIR
from backend.core.audio import _generate_edge_tts, VOICE_FEMALE_1


FREESTYLE_SYSTEM_PROMPT = """You are a friendly Dutch conversation partner.
- Speak at A1-A2 level using simple vocabulary and short sentences (2-4 sentences per turn)
- If the user makes mistakes, gently model the correct form in your response
- Be encouraging and natural — this is a casual conversation, not a lesson
- Always respond in Dutch unless the user explicitly asks for English
- Keep it conversational: ask follow-up questions to keep the dialogue going"""


def _get_client():
    from openai import OpenAI
    return OpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL)


def _flush_sentence(buffer: str, session_prefix: str, index: int) -> dict | None:
    """Generate TTS for a sentence and return an event dict."""
    text = buffer.strip()
    if not text:
        return None
    filename = f"{session_prefix}_{index:02d}.mp3"
    path = AUDIO_SPEAKING_DIR / filename
    AUDIO_SPEAKING_DIR.mkdir(parents=True, exist_ok=True)
    _generate_edge_tts(text, path, voice=VOICE_FEMALE_1)
    return {"type": "sentence", "text": text, "audio": filename}


def stream_freestyle_response(
    conversation_history: list[dict],
    user_transcript: str,
    session_prefix: str,
) -> Generator[dict, None, None]:
    """
    Stream LLM response, detect sentence boundaries, generate TTS per sentence.
    Yields dicts:
      {"type": "sentence", "text": "Hallo!", "audio": "freestyle_..._00.mp3"}
      {"type": "done", "full_text": "Hallo! Hoe gaat het?"}
    """
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY / DASHSCOPE_API_KEY is not set")

    client = _get_client()

    messages = [{"role": "system", "content": FREESTYLE_SYSTEM_PROMPT}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_transcript})

    stream = client.chat.completions.create(
        model=AI_MODEL,
        messages=messages,
        temperature=0.7,
        stream=True,
    )

    buffer = ""
    full_text = ""
    sentence_index = 0
    sentence_end_re = re.compile(r'[.!?]\s')

    for chunk in stream:
        delta = chunk.choices[0].delta
        if not delta.content:
            continue
        token = delta.content
        buffer += token
        full_text += token

        # Check for sentence boundaries
        while True:
            match = sentence_end_re.search(buffer)
            if not match:
                break
            # Split at the end of the sentence (include the punctuation)
            split_pos = match.start() + 1  # include the punctuation char
            sentence = buffer[:split_pos]
            buffer = buffer[split_pos:].lstrip()

            event = _flush_sentence(sentence, session_prefix, sentence_index)
            if event:
                sentence_index += 1
                yield event

    # Flush remaining buffer
    if buffer.strip():
        event = _flush_sentence(buffer, session_prefix, sentence_index)
        if event:
            yield event

    yield {"type": "done", "full_text": full_text.strip()}
