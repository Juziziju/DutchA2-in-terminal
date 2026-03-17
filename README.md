# DutchA2 Blitz

An open-source, AI-powered Dutch language learning platform built for the **Inburgering A2 exam**. Practice all five exam sections — Lezen, Luisteren, Schrijven, Spreken, and KNM — with adaptive AI exercises, spaced repetition, and detailed analytics.

## Why This Project?

Preparing for the Dutch Inburgering exam is hard. Existing tools are expensive, static, and don't adapt to your weak areas. DutchA2 Blitz generates **unlimited practice material** using AI, tracks your progress with spaced repetition, and focuses your study time where it matters most.

## Features

### Core Exam Skills

| Skill | What You Practice |
|-------|-------------------|
| **Flashcards** | SM-2 spaced repetition with bidirectional cards (NL↔EN), spelling tests, audio playback |
| **Listening** | AI-generated dialogues & dictation at A1/A2/B1, multi-voice Dutch TTS, comprehension questions |
| **Reading** | AI-generated passages (short texts, emails, articles, ads, notices) with comprehension questions |
| **Writing** | Email, short story, form-filling prompts with AI grading — grammar errors, vocabulary, completeness |
| **Speaking** | 15+ scene-based exercises, audio recording, AI transcription & scoring (grammar, fluency, pronunciation) |
| **KNM** | Dutch society & culture questions across 7 categories (work, health, government, customs, housing, education, finance) |

### Beyond the Basics

- **Error Correction** — Spot and fix grammar mistakes in AI-generated sentences
- **Spell Practice** — Translate English sentences to Dutch with hints and AI review
- **Freestyle Talk** — Open-ended conversation with a Dutch AI tutor (streaming responses)
- **Mock Exams** — Full 5-section exam simulation with countdown timer
- **Adaptive Planner** — Placement test → daily study plans → weekly reports, all adjusted to your exam date
- **Learning Advisor** — AI analysis of your progress, weak areas, and personalized recommendations
- **Personal Vocab** — Add your own words/phrases with context-aware translation and SM-2 review
- **Practice Again** — Replay any past exercise from your history until you get 100%

## Tech Stack

### Backend

- **FastAPI** + **SQLModel** — REST API with Pydantic validation
- **SQLite** (local) / **PostgreSQL** via Supabase (production)
- **Qwen LLM** (DashScope API) — Content generation, grading, translation
- **Edge TTS** — Multi-voice Dutch audio (4 voices: Colette, Fenna, Maarten, Arnaud)
- **JWT** + **bcrypt** — Authentication

### Frontend

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** — Utility-first styling
- **Recharts** — Progress charts and radar visualizations
- **React Router v6** — Client-side routing

### Hosting

- **Backend**: Render.com (auto-deploy via `render.yaml`)
- **Frontend**: Vercel
- **Database**: Supabase PostgreSQL (free tier)
- **Audio**: Supabase Storage

## Project Structure

```
DutchA2/
├── backend/
│   ├── main.py                 # FastAPI app, route registration
│   ├── config.py               # Environment variable loading
│   ├── database.py             # SQLModel engine & session
│   ├── routers/
│   │   ├── auth.py             # Registration, JWT login
│   │   ├── vocab.py            # Vocabulary list, sync, audio
│   │   ├── flashcards.py       # SM-2 sessions & reviews
│   │   ├── listening.py        # Dialogue generation + audio
│   │   ├── reading.py          # Passage generation + questions
│   │   ├── writing.py          # Prompts, grading, error correction, spell
│   │   ├── speaking.py         # Scene practice, audio upload, AI review
│   │   ├── knm.py              # Society/culture questions
│   │   ├── exam.py             # Mock exam (5 sections)
│   │   ├── planner.py          # Adaptive daily/weekly plans
│   │   ├── advisor.py          # AI learning advisor
│   │   ├── freestyle.py        # Conversational AI (SSE)
│   │   ├── personal_vocab.py   # User-added translations
│   │   └── results.py          # History, trends, analytics
│   ├── core/
│   │   ├── sm2.py              # SM-2 spaced repetition algorithm
│   │   ├── qwen.py             # LLM calls (Qwen via DashScope)
│   │   ├── audio.py            # TTS generation (Edge TTS + gTTS)
│   │   ├── auth.py             # JWT + bcrypt utilities
│   │   ├── writing_ai.py       # Writing prompt & grading AI
│   │   ├── spell_ai.py         # Translation exercise AI
│   │   ├── reading_ai.py       # Reading passage AI
│   │   ├── knm_ai.py           # KNM question AI
│   │   ├── speaking_ai.py      # Speech transcription & review
│   │   ├── freestyle_ai.py     # Streaming conversation AI
│   │   ├── planner_ai.py       # Adaptive plan generation
│   │   ├── advisor_ai.py       # Learning analysis AI
│   │   ├── grammar_rules.py    # A2 grammar reference
│   │   ├── metrics.py          # Stats aggregation & trends
│   │   └── storage.py          # Supabase file operations
│   └── models/                 # SQLModel table definitions
│       ├── user.py, vocab.py, progress.py, review_log.py,
│       ├── listening.py, speaking.py, reading.py, writing.py,
│       ├── knm.py, exam.py, custom_scene.py, personal_vocab.py,
│       ├── daily_plan.py, weekly_report.py, skill_snapshot.py,
│       ├── user_profile.py, placement.py
│       └── ...
├── frontend/
│   ├── src/
│   │   ├── api.ts              # Typed fetch wrappers for all endpoints
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Main hub, progress overview
│   │   │   ├── Flashcards.tsx      # SM-2 review interface
│   │   │   ├── Listening.tsx       # Dialogue + dictation practice
│   │   │   ├── Reading.tsx         # Passage comprehension
│   │   │   ├── Writing.tsx         # Email/story/form/error correction
│   │   │   ├── SpellPractice.tsx   # EN→NL translation exercises
│   │   │   ├── Speaking.tsx        # Audio recording + AI review
│   │   │   ├── KNMExercise.tsx     # Society/culture practice
│   │   │   ├── MockExam.tsx        # Full exam simulation
│   │   │   ├── Planner.tsx         # Adaptive study planner
│   │   │   ├── Advisor.tsx         # AI learning advisor
│   │   │   ├── FreestyleTalk.tsx   # Conversational AI chat
│   │   │   ├── StudyMaterial.tsx   # History + practice again
│   │   │   ├── VocabNotebook.tsx   # Vocabulary browser
│   │   │   └── Settings.tsx        # User preferences
│   │   ├── components/         # Reusable UI components
│   │   └── contexts/           # React context providers
│   ├── package.json
│   └── vite.config.ts
├── requirements.txt            # Python dependencies
├── render.yaml                 # Render.com deployment config
└── vocab_input.csv             # Initial vocabulary data (185 words)
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [DashScope API key](https://dashscope.aliyun.com/) (for Qwen LLM)

### Setup

```bash
git clone <repo-url> DutchA2
cd DutchA2

# Backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — add your DASHSCOPE_API_KEY and SECRET_KEY

# Import initial vocabulary (creates admin/changeme user)
PYTHONPATH=. .venv/bin/python -m backend.migrate
```

### Run

```bash
# Terminal 1 — Backend
PYTHONPATH=. .venv/bin/uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open http://localhost:5173 and log in with `admin` / `changeme`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DASHSCOPE_API_KEY` | Yes | Qwen LLM API key |
| `SECRET_KEY` | Yes | JWT signing secret |
| `DATABASE_URL` | No | PostgreSQL URL (defaults to SQLite) |
| `ALLOWED_ORIGINS` | No | Extra CORS origins (comma-separated) |
| `CONTENT_MODEL` | No | LLM model for complex tasks (default: `qwen3.5-plus-2026-02-15`) |
| `FAST_MODEL` | No | LLM model for lightweight tasks (default: `qwen-turbo-latest`) |

## Contributing

We'd love your help making Dutch language learning easier and more effective! Here are some areas where contributions would be especially valuable:

### Better Learning Methods

- **New exercise types** — Cloze tests, word ordering, listening gap-fill, picture description
- **Gamification** — Streaks, achievements, leaderboards, XP systems
- **Social features** — Study groups, peer correction, conversation partners
- **Pronunciation scoring** — Phoneme-level feedback using speech recognition
- **Contextual grammar** — Teach grammar rules inline when errors are detected, not as separate lessons

### Content & Coverage

- **More vocabulary** — Expand beyond the current 185-word A2 set
- **B1/B2 content** — Extend the platform for advanced learners
- **Real exam materials** — Integrate official DUO practice exams
- **Cultural scenarios** — More realistic KNM situations and case studies

### Technical Improvements

- **Offline mode** — PWA with service worker for studying without internet
- **Mobile app** — React Native or Flutter wrapper
- **Alternative LLM backends** — Support for OpenAI, Claude, local models (Ollama)
- **Voice input** — Real-time speech recognition for speaking exercises
- **Accessibility** — Screen reader support, keyboard navigation, high-contrast themes

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-idea`)
3. Make your changes
4. Run the TypeScript check (`cd frontend && npx tsc --noEmit`)
5. Submit a pull request with a clear description

Whether it's a new exercise type, a UI improvement, a bug fix, or just an idea in a discussion — all contributions are welcome.

## License

MIT
