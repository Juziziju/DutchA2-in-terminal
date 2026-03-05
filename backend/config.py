"""Application configuration — reads from environment / .env file."""

import os
from pathlib import Path

# Resolve paths relative to the DutchA2 root (one level above backend/)
BACKEND_DIR = Path(__file__).parent
ROOT_DIR = BACKEND_DIR.parent

# Load .env from backend/ if it exists (simple manual load, no python-dotenv needed)
_env_file = BACKEND_DIR / ".env"
if _env_file.exists():
    with open(_env_file, encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line or _line.startswith("#") or "=" not in _line:
                continue
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

# ── Secrets ───────────────────────────────────────────────────────────────────

SECRET_KEY: str = os.environ.get("SECRET_KEY", "change-me-in-production-please")
DASHSCOPE_API_KEY: str = os.environ.get("DASHSCOPE_API_KEY", "")

# ── Database ──────────────────────────────────────────────────────────────────

_db_url = os.environ.get("DATABASE_URL", "")
# Fall back to local SQLite if the URL is unset or still contains a placeholder
if not _db_url or "[placeholder]" in _db_url or "[project-ref]" in _db_url:
    _db_url = f"sqlite:///{ROOT_DIR / 'dutch_a2.db'}"
DATABASE_URL: str = _db_url

# ── Paths ─────────────────────────────────────────────────────────────────────

AUDIO_DIR: Path = ROOT_DIR / "audio"
AUDIO_LISTENING_DIR: Path = ROOT_DIR / "audio_listening"
VOCAB_CSV: Path = ROOT_DIR / "vocab_input.csv"

# ── Auth ──────────────────────────────────────────────────────────────────────

ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
    os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080")  # 7 days
)
ALGORITHM: str = "HS256"
