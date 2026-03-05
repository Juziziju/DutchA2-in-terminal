# DutchA2 Blitz — Agent Reference

## Overview
A Dutch A2 language learning web app with spaced repetition flashcards, AI-generated listening exercises, and mock exams.

## Stack
- **Backend**: FastAPI + SQLModel + SQLite (local) / PostgreSQL (production via Supabase)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Recharts
- **Auth**: JWT (python-jose) + bcrypt (direct, NOT passlib)
- **AI**: Qwen/DashScope for listening dialogue generation
- **TTS**: gTTS for audio generation

## Project Structure
```
DutchA2/
├── backend/
│   ├── main.py              # FastAPI app, router registration, SPA serving
│   ├── config.py            # Env vars, paths, secrets
│   ├── database.py          # SQLModel engine + session dependency
│   ├── core/
│   │   ├── sm2.py           # SM-2 spaced repetition algorithm
│   │   ├── qwen.py          # Qwen/DashScope LLM calls
│   │   ├── audio.py         # gTTS wrappers
│   │   └── auth.py          # bcrypt + JWT helpers
│   ├── models/
│   │   ├── user.py           # User model
│   │   ├── vocab.py          # Vocab model (185 Dutch words)
│   │   ├── progress.py       # FlashcardProgress (SM-2 state per user×vocab×direction)
│   │   ├── review_log.py     # FlashcardReviewLog (per-review log for trends)
│   │   ├── listening.py      # ListeningSession (log_json stores full dialogue)
│   │   └── exam.py           # ExamResult
│   ├── routers/
│   │   ├── auth.py           # /auth/login, /auth/register
│   │   ├── vocab.py          # /vocab, /vocab/sync
│   │   ├── flashcards.py     # /flashcards/session, /flashcards/review
│   │   ├── listening.py      # /listening/generate, /listening/submit
│   │   ├── exam.py           # /exam/session, /exam/submit
│   │   └── results.py        # /results/* (stats, trends, history, detail)
│   └── migrate.py            # One-time JSON/CSV data import
├── frontend/
│   ├── src/
│   │   ├── api.ts            # All typed fetch wrappers
│   │   ├── pages/
│   │   │   ├── Flashcards.tsx    # Setup → session → review flow
│   │   │   ├── StudyMaterial.tsx  # Stats, trends (Recharts), history
│   │   │   ├── Listening.tsx      # AI dialogue + quiz
│   │   │   └── Exam.tsx           # Mock exam
│   │   ├── contexts/
│   │   │   └── FlashcardsContext.tsx  # Flashcard state management
│   │   ├── components/
│   │   │   ├── Sidebar.tsx       # Collapsible sidebar with avatar
│   │   │   └── SidebarItem.tsx   # Nav items
│   │   └── layouts/
│   │       └── AppLayout.tsx     # Main layout with sidebar + header
│   ├── vite.config.ts        # Dev proxy to backend:8000
│   └── vercel.json           # Vercel deployment config
├── render.yaml               # Render.com deployment config
├── requirements.txt          # Python dependencies
└── dutch_a2.db               # SQLite database (auto-created)
```

## Key Design Decisions

### Flashcard SM-2 System
- **Lazy progress creation**: FlashcardProgress records are only created when a user reviews a card for the first time. New cards use `progress_id=-1` in the API.
- **Directions**: Each vocab word can be reviewed in two directions: `nl_en` (Dutch→English) and `en_nl` (English→Dutch). Each direction has its own progress record.
- **Session flow**: Setup (choose mode) → Loading → Front/Back → Done. User can select direction (nl_en, en_nl, both) and enable spelling test for en_nl cards.
- **Keyboard shortcuts**: ← Forget, ↑ Blurry, → Remember, ↓ Mastered, Space to reveal.
- **Mastered**: Marks BOTH directions of the word as mastered.

### Listening System
- `/listening/generate` calls Qwen to create a dialogue with questions
- `/listening/submit` grades answers, stores full session in `log_json`
- `log_json` contains: dialogue lines, questions with user_answers, vocab_used
- `/results/listening/{id}` returns parsed detail for review

### Stats & Trends
- `total_cards` = count of vocab words (not progress records)
- `due_today` = cards with repetitions > 0, not mastered, next_review <= today
- Trend endpoints aggregate last 30 days from FlashcardReviewLog / ListeningSession / ExamResult
- Recharts LineChart used for visualization

## Running Locally
```bash
cd DutchA2

# Backend
PYTHONPATH=. .venv/bin/uvicorn backend.main:app --reload --port 8000

# Frontend dev (separate terminal)
cd frontend && npm run dev

# Production build (served by FastAPI from frontend/dist/)
cd frontend && npm run build
```

## Environment Variables
Place in `backend/.env`:
- `DATABASE_URL` — PostgreSQL URL for production (falls back to SQLite)
- `DASHSCOPE_API_KEY` — for Qwen LLM (listening generation)
- `SECRET_KEY` — JWT signing secret
- `ALLOWED_ORIGINS` — comma-separated CORS origins

## Deployment
- **Database**: Supabase PostgreSQL (free tier)
- **Backend**: Render.com (`render.yaml` at root)
- **Frontend**: Either Vercel (set `VITE_API_BASE`) or served by FastAPI from `frontend/dist/`

### Mock Exam System
- `backend/core/exam_bank.py` — 21 questions across 5 sections (LZ/LU/SC/SP/KNM)
- `GET /exam/questions/{section}` — returns questions without answers
- `POST /exam/grade/{section}` — grades MC answers, returns explanations
- `POST /exam/submit` — saves final scores to ExamResult table
- SC (writing) and SP (speaking) are self-graded for now

### Database Migration (SQLite → Supabase PostgreSQL)
```bash
PYTHONPATH=. .venv/bin/python -m backend.migrate_to_pg "postgresql://postgres.xxx:pw@host:6543/postgres"
```
- Migrates all tables with data
- Fixes PostgreSQL auto-increment sequences
- Skips tables that already have data on target

## Common Tasks

### Add new vocab words
Add to `vocab_input.csv`, then run `/vocab/sync` endpoint.

### Reset flashcard progress
```sql
DELETE FROM flashcardprogress WHERE user_id = ?;
DELETE FROM flashcardreviewlog WHERE user_id = ?;
```

### Check database state
```bash
PYTHONPATH=. .venv/bin/python -c "
from backend.database import engine
from sqlalchemy import text
with engine.connect() as c:
    print('Vocab:', c.execute(text('SELECT count(*) FROM vocab')).scalar())
    print('Progress:', c.execute(text('SELECT count(*) FROM flashcardprogress')).scalar())
    print('Review logs:', c.execute(text('SELECT count(*) FROM flashcardreviewlog')).scalar())
    print('Listening:', c.execute(text('SELECT count(*) FROM listeningsession')).scalar())
"
```
