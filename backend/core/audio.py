"""Audio generation — Edge TTS for multi-voice, gTTS as fallback for vocab."""

import asyncio
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from backend.config import AUDIO_DIR, AUDIO_LISTENING_DIR
from backend.core.storage import upload_file, public_url

# ── Edge TTS Dutch voices ────────────────────────────────────────────────────

VOICE_FEMALE_1 = "nl-NL-ColetteNeural"
VOICE_FEMALE_2 = "nl-NL-FennaNeural"
VOICE_MALE_1 = "nl-NL-MaartenNeural"
VOICE_MALE_2 = "nl-BE-ArnaudNeural"

# Rotate voices: first speaker gets female, second gets male, etc.
_VOICE_POOL = [VOICE_FEMALE_1, VOICE_MALE_1, VOICE_FEMALE_2, VOICE_MALE_2]


def _assign_voices(dialogue: list[dict]) -> dict[str, str]:
    """Assign a unique voice to each speaker in the dialogue."""
    speakers: list[str] = []
    for line in dialogue:
        s = line.get("speaker", "")
        if s and s not in speakers:
            speakers.append(s)
    return {s: _VOICE_POOL[i % len(_VOICE_POOL)] for i, s in enumerate(speakers)}


async def _edge_tts_generate(text: str, voice: str, path: Path) -> None:
    """Generate MP3 using Edge TTS."""
    import edge_tts
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(path))


def _generate_edge_tts(text: str, path: Path, voice: str = VOICE_FEMALE_1) -> None:
    """Sync wrapper for Edge TTS generation."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # If already in an async context, create a new thread
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            pool.submit(lambda: asyncio.run(_edge_tts_generate(text, voice, path))).result()
    else:
        asyncio.run(_edge_tts_generate(text, voice, path))


# ── Helpers ──────────────────────────────────────────────────────────────────

def safe_filename(dutch_word: str) -> str:
    """Convert a Dutch word/phrase to a safe MP3 filename."""
    name = dutch_word.lower().strip()
    name = re.sub(r"[^\w\s-]", "", name)
    name = re.sub(r"\s+", "_", name)
    return name + ".mp3"


# ── Vocab audio (single voice) ──────────────────────────────────────────────

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
        _generate_edge_tts(dutch_word, path, voice=VOICE_FEMALE_1)
        try:
            with open(path, "rb") as f:
                upload_file("vocab", filename, f.read())
        except Exception:
            pass
    return filename


def vocab_audio_url(filename: str) -> str:
    return public_url("vocab", filename)


def listening_audio_url(filename: str) -> str:
    return public_url("listening", filename)


def speaking_audio_url(filename: str) -> str:
    return public_url("speaking", filename)


# ── Dialogue audio (multi-voice) ────────────────────────────────────────────

def generate_dialogue_audio(dialogue: list[dict], session_prefix: str) -> list[Optional[str]]:
    """
    Generate one MP3 per dialogue line with different voices per speaker.
    Returns a list of relative filenames, or None for failures.
    Uses asyncio.gather to parallelize TTS generation for speed.
    Also uploads to Supabase Storage.
    """
    AUDIO_LISTENING_DIR.mkdir(parents=True, exist_ok=True)
    voice_map = _assign_voices(dialogue)

    items: list[tuple[str, Path, str, str]] = []
    for i, line in enumerate(dialogue):
        filename = f"{session_prefix}_line_{i:02d}.mp3"
        path = AUDIO_LISTENING_DIR / filename
        speaker = line.get("speaker", "")
        voice = voice_map.get(speaker, VOICE_FEMALE_1)
        items.append((filename, path, line["text"], voice))

    async def _gen_all():
        import edge_tts

        async def _gen_one(fn: str, p: Path, text: str, v: str) -> Optional[str]:
            try:
                comm = edge_tts.Communicate(text, v)
                await comm.save(str(p))
                try:
                    with open(p, "rb") as f:
                        upload_file("listening", fn, f.read())
                except Exception:
                    pass
                return fn
            except Exception:
                return None

        return await asyncio.gather(*[_gen_one(fn, p, t, v) for fn, p, t, v in items])

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            results = pool.submit(lambda: asyncio.run(_gen_all())).result()
    else:
        results = asyncio.run(_gen_all())

    return list(results)


def new_session_prefix() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")
