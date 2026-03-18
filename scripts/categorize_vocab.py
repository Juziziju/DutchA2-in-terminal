#!/usr/bin/env python3
"""One-time script: categorize all vocab words in the database.

Connects to whatever DATABASE_URL is configured (Supabase prod or local SQLite)
and batch-updates vocab.category using the hardcoded CATEGORY_MAP.

Usage:
    cd DutchA2
    PYTHONPATH=. .venv/bin/python scripts/categorize_vocab.py
"""

from collections import Counter

from sqlmodel import Session, select

from backend.core.vocab_categories import CATEGORY_MAP
from backend.database import engine
from backend.models.vocab import Vocab


def main() -> None:
    with Session(engine) as session:
        all_vocab = session.exec(select(Vocab)).all()
        print(f"Total vocab in DB: {len(all_vocab)}")

        updated = 0
        unmatched: list[str] = []

        for v in all_vocab:
            new_cat = CATEGORY_MAP.get(v.dutch)
            if new_cat is None:
                unmatched.append(v.dutch)
                continue
            if v.category != new_cat:
                v.category = new_cat
                session.add(v)
                updated += 1

        session.commit()

        # ── Stats ────────────────────────────────────────────────────────
        # Re-read to get final state
        all_vocab = session.exec(select(Vocab)).all()
        counts = Counter(v.category for v in all_vocab)

        print(f"\nUpdated: {updated} words")
        print(f"Unmatched (kept current category): {len(unmatched)}")
        if unmatched:
            for w in sorted(unmatched):
                print(f"  - {w}")

        print(f"\n{'Category':<30} Count")
        print("-" * 40)
        for cat, cnt in sorted(counts.items(), key=lambda x: -x[1]):
            print(f"{cat:<30} {cnt}")


if __name__ == "__main__":
    main()
