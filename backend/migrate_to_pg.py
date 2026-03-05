"""Migrate data from local SQLite to Supabase PostgreSQL.

Usage:
    PYTHONPATH=. .venv/bin/python -m backend.migrate_to_pg <supabase_url>

Example:
    PYTHONPATH=. .venv/bin/python -m backend.migrate_to_pg "postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"

This script:
1. Reads all data from local SQLite (dutch_a2.db)
2. Creates tables on the target PostgreSQL database
3. Inserts all rows, preserving IDs
"""

import sys
from datetime import date, datetime

from sqlmodel import Session, SQLModel, create_engine, select

# Import all models so metadata is complete
from backend.models.user import User
from backend.models.vocab import Vocab
from backend.models.progress import FlashcardProgress
from backend.models.review_log import FlashcardReviewLog
from backend.models.listening import ListeningSession
from backend.models.exam import ExamResult
from backend.config import ROOT_DIR


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m backend.migrate_to_pg <postgresql_url>")
        print('Example: python -m backend.migrate_to_pg "postgresql://postgres.xxx:pw@host:6543/postgres"')
        sys.exit(1)

    pg_url = sys.argv[1]
    if not pg_url.startswith("postgresql"):
        print(f"Error: URL must start with 'postgresql'. Got: {pg_url[:30]}...")
        sys.exit(1)

    sqlite_url = f"sqlite:///{ROOT_DIR / 'dutch_a2.db'}"

    print(f"Source: {sqlite_url}")
    print(f"Target: {pg_url[:50]}...")

    src_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    dst_engine = create_engine(pg_url)

    # Create all tables on PostgreSQL
    print("\nCreating tables on PostgreSQL...")
    SQLModel.metadata.create_all(dst_engine)
    print("Tables created.")

    # Migrate each table
    tables = [
        ("User", User),
        ("Vocab", Vocab),
        ("FlashcardProgress", FlashcardProgress),
        ("FlashcardReviewLog", FlashcardReviewLog),
        ("ListeningSession", ListeningSession),
        ("ExamResult", ExamResult),
    ]

    for name, model in tables:
        with Session(src_engine) as src_db:
            rows = src_db.exec(select(model)).all()

        if not rows:
            print(f"  {name}: 0 rows (skip)")
            continue

        with Session(dst_engine) as dst_db:
            # Check if target already has data
            existing = dst_db.exec(select(model)).first()
            if existing:
                print(f"  {name}: target already has data, skipping (delete manually to re-import)")
                continue

            for row in rows:
                # Detach from source session and add to destination
                data = {}
                for col in model.__table__.columns:
                    data[col.name] = getattr(row, col.name)
                dst_db.add(model(**data))

            dst_db.commit()
            print(f"  {name}: {len(rows)} rows migrated")

    # Fix PostgreSQL sequences (auto-increment) to continue after max ID
    print("\nFixing sequences...")
    with dst_engine.connect() as conn:
        for name, model in tables:
            table_name = model.__tablename__
            try:
                result = conn.execute(
                    __import__('sqlalchemy').text(f"SELECT MAX(id) FROM {table_name}")
                ).scalar()
                if result:
                    seq_name = f"{table_name}_id_seq"
                    conn.execute(
                        __import__('sqlalchemy').text(f"SELECT setval('{seq_name}', {result})")
                    )
                    print(f"  {table_name}_id_seq set to {result}")
            except Exception as e:
                print(f"  {table_name}: sequence fix skipped ({e})")
        conn.commit()

    print("\nMigration complete!")


if __name__ == "__main__":
    main()
