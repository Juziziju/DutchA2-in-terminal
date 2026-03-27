"""One-time backfill: assign subtopic to existing WritingSessions based on topic keywords."""

import json
from sqlmodel import Session, select
from backend.database import engine
from backend.models.writing import WritingSession
from backend.data.writing_subtopics import WRITING_SUBTOPICS

# Build keyword -> (task_type, subtopic_key) mapping
KEYWORD_MAP: list[tuple[list[str], str, str]] = []
for task_type, subtopics in WRITING_SUBTOPICS.items():
    for st in subtopics:
        # Generate keywords from key and labels
        keywords = [
            st["key"].replace("_", " "),
            st["label_nl"].lower(),
            st["label_en"].lower(),
        ]
        KEYWORD_MAP.append((keywords, task_type, st["key"]))


def match_subtopic(task_type: str, topic: str, prompt_json: str) -> str | None:
    """Try to match a subtopic based on topic/prompt text."""
    text = (topic + " " + prompt_json).lower()
    for keywords, tt, key in KEYWORD_MAP:
        if tt != task_type:
            continue
        for kw in keywords:
            if kw in text:
                return key
    return None


def main():
    with Session(engine) as db:
        rows = db.exec(
            select(WritingSession).where(
                WritingSession.subtopic.is_(None),  # type: ignore[union-attr]
                WritingSession.task_type.in_(list(WRITING_SUBTOPICS.keys())),  # type: ignore[union-attr]
            )
        ).all()

        updated = 0
        for r in rows:
            st = match_subtopic(r.task_type, r.topic, r.prompt_json or "")
            if st:
                r.subtopic = st
                db.add(r)
                updated += 1

        db.commit()
        print(f"Backfilled {updated}/{len(rows)} sessions with subtopics.")


if __name__ == "__main__":
    main()
