"""gTTS audio generation — extracted from scripts/generate_vocab.py and listening.py."""

import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from backend.config import AUDIO_DIR, AUDIO_LISTENING_DIR
from backend.core.storage import upload_file, public_url


def safe_filename(dutch_word: str) -> str:
    """Convert a Dutch word/phrase to a safe MP3 filename."""
    name = dutch_word.lower().strip()
    name = re.sub(r"[^\w\s-]", "", name)
    name = re.sub(r"\s+", "_", name)
    return name + ".mp3"


def ensure_vocab_audio(dutch_word: str) -> str:
    """
    Generate TTS audio for a vocab word if it doesn't already exist.
    Returns the relative filename (e.g. 'appel.mp3').
    Also uploads to Supabase Storage.
    """
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    filename = safe_filename(dutch_word)
    path = AUDIO_DIR / filename
    if not path.exists():
        _generate_mp3(dutch_word, path)
        # Upload to Supabase
        try:
            with open(path, "rb") as f:
                upload_file("vocab", filename, f.read())
        except Exception:
            pass
    return filename


def vocab_audio_url(filename: str) -> str:
    """Return the Supabase public URL for a vocab audio file."""
    return public_url("vocab", filename)


def listening_audio_url(filename: str) -> str:
    """Return the Supabase public URL for a listening audio file."""
    return public_url("listening", filename)


def speaking_audio_url(filename: str) -> str:
    """Return the Supabase public URL for a speaking audio file."""
    return public_url("speaking", filename)


def generate_dialogue_audio(dialogue: list[dict], session_prefix: str) -> list[Optional[str]]:
    """
    Generate one MP3 per dialogue line.
    Returns a list of relative filenames (relative to AUDIO_LISTENING_DIR),
    or None entries for lines that failed.
    Also uploads to Supabase Storage.
    """
    AUDIO_LISTENING_DIR.mkdir(parents=True, exist_ok=True)
    filenames: list[Optional[str]] = []
    for i, line in enumerate(dialogue):
        filename = f"{session_prefix}_line_{i:02d}.mp3"
        path = AUDIO_LISTENING_DIR / filename
        try:
            _generate_mp3(line["text"], path, lang="nl")
            # Upload to Supabase
            try:
                with open(path, "rb") as f:
                    upload_file("listening", filename, f.read())
            except Exception:
                pass
            filenames.append(filename)
        except Exception:
            filenames.append(None)
    return filenames


def new_session_prefix() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _generate_mp3(text: str, path: Path, lang: str = "nl") -> None:
    from gtts import gTTS
    gTTS(text=text, lang=lang).save(str(path))
