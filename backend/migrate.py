"""
One-time migration: import existing JSON/CSV data into the SQLite database.

Usage:
    cd DutchA2
    python -m backend.migrate

What it does:
  1. Creates a default user 'admin' (password: changeme) if no users exist.
  2. Imports vocab_input.csv → Vocab table.
  3. Imports scripts/progress.json → FlashcardProgress (for admin user).
  4. Imports scripts/listening_log.json → ListeningSession (for admin user).
  5. Imports ~/.dutch_a2_blitz/mock_exam_log.json → ExamResult (for admin user).
"""

import csv
import json
import sys
from datetime import date, datetime
from pathlib import Path

# Ensure project root is in path when running as __main__
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select

from backend.config import AUDIO_DIR, VOCAB_CSV
from backend.core.audio import safe_filename
from backend.core.auth import hash_password
from backend.database import create_db_and_tables, engine
from backend.models.exam import ExamResult
from backend.models.listening import ListeningSession
from backend.models.progress import FlashcardProgress
from backend.models.user import User
from backend.models.vocab import Vocab

SCRIPT_DIR = Path(__file__).parent.parent / "scripts"
PROGRESS_JSON = SCRIPT_DIR / "progress.json"
LISTENING_LOG = SCRIPT_DIR / "listening_log.json"
MOCK_EXAM_LOG = Path.home() / ".dutch_a2_blitz" / "mock_exam_log.json"


def get_or_create_admin(session: Session) -> User:
    user = session.exec(select(User).where(User.username == "admin")).first()
    if not user:
        user = User(username="admin", hashed_password=hash_password("changeme"))
        session.add(user)
        session.commit()
        session.refresh(user)
        print("Created default user: admin / changeme")
    else:
        print(f"Using existing user: {user.username} (id={user.id})")
    return user


def import_vocab(session: Session) -> dict[str, int]:
    """Returns mapping dutch → vocab_id."""
    existing = {v.dutch: v.id for v in session.exec(select(Vocab)).all()}
    if not VOCAB_CSV.exists():
        print(f"  vocab_input.csv not found at {VOCAB_CSV}, skipping.")
        return existing

    added = 0
    with open(VOCAB_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            dutch = row.get("dutch", "").strip()
            english = row.get("english", "").strip()
            if not dutch or not english or dutch in existing:
                continue
            audio_file = ""
            mp3_path = AUDIO_DIR / safe_filename(dutch)
            if mp3_path.exists():
                audio_file = mp3_path.name
            v = Vocab(
                dutch=dutch,
                english=english,
                category=row.get("category", "General").strip() or "General",
                example_dutch=row.get("example_dutch", "").strip(),
                example_english=row.get("example_english", "").strip(),
                audio_file=audio_file,
            )
            session.add(v)
            session.flush()
            existing[dutch] = v.id
            added += 1

    session.commit()
    print(f"  Vocab: imported {added} new words ({len(existing)} total)")
    return existing


def import_progress(session: Session, user: User, vocab_map: dict[str, int]):
    if not PROGRESS_JSON.exists():
        print("  progress.json not found, skipping.")
        return

    with open(PROGRESS_JSON, encoding="utf-8") as f:
        data = json.load(f)

    added = 0
    for key, state in data.items():
        # key format: "dutch_word_direction" e.g. "bier_en_nl"
        direction = state.get("direction", "")
        if direction not in ("nl_en", "en_nl"):
            continue
        # strip the trailing _direction suffix to recover the dutch word
        suffix = f"_{direction}"
        if not key.endswith(suffix):
            continue
        dutch = key[: -len(suffix)]
        vocab_id = vocab_map.get(dutch)
        if vocab_id is None:
            continue  # word not in DB

        # Skip if already imported
        existing = session.exec(
            select(FlashcardProgress).where(
                FlashcardProgress.user_id == user.id,
                FlashcardProgress.vocab_id == vocab_id,
                FlashcardProgress.direction == direction,
            )
        ).first()
        if existing:
            continue

        next_review_str = state.get("next_review", date.today().isoformat())
        prog = FlashcardProgress(
            user_id=user.id,
            vocab_id=vocab_id,
            direction=direction,
            interval=state.get("interval", 1),
            ease_factor=state.get("ease_factor", 2.5),
            repetitions=state.get("repetitions", 0),
            next_review=date.fromisoformat(next_review_str),
            mastered=state.get("mastered", False),
        )
        session.add(prog)
        added += 1

    session.commit()
    print(f"  Progress: imported {added} cards")


def import_listening(session: Session, user: User):
    if not LISTENING_LOG.exists():
        print("  listening_log.json not found, skipping.")
        return

    with open(LISTENING_LOG, encoding="utf-8") as f:
        data = json.load(f)

    sessions = data.get("sessions", [])
    added = 0
    for s in sessions:
        ls = ListeningSession(
            user_id=user.id,
            topic=s.get("topic", ""),
            score_pct=s.get("percentage", 0),
            date=datetime.fromisoformat(s.get("date", datetime.utcnow().isoformat())),
            log_json=json.dumps(s, ensure_ascii=False),
        )
        session.add(ls)
        added += 1

    session.commit()
    print(f"  Listening: imported {added} sessions")


def import_exam(session: Session, user: User):
    if not MOCK_EXAM_LOG.exists():
        print("  mock_exam_log.json not found, skipping.")
        return

    with open(MOCK_EXAM_LOG, encoding="utf-8") as f:
        data = json.load(f)

    results = data.get("results", [])
    added = 0
    for r in results:
        er = ExamResult(
            user_id=user.id,
            date=datetime.fromisoformat(r.get("date", datetime.utcnow().isoformat())),
            source=r.get("source", "ai"),
            scores_json=json.dumps(r.get("scores", {})),
            avg_score=r.get("avg"),
            passed=r.get("passed", False),
        )
        session.add(er)
        added += 1

    session.commit()
    print(f"  Exam results: imported {added} records")


def main():
    print("Dutch A2 Blitz — database migration")
    print("=" * 40)
    create_db_and_tables()

    with Session(engine) as session:
        user = get_or_create_admin(session)
        vocab_map = import_vocab(session)
        import_progress(session, user, vocab_map)
        import_listening(session, user)
        import_exam(session, user)

    print("=" * 40)
    print("Migration complete.")
    print()
    print("Login with:  admin / changeme")
    print("(Change the password in the app settings after first login.)")


if __name__ == "__main__":
    main()
