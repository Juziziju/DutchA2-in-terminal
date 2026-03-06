# Adaptive Learning Planner — Development Status

> Last updated: 2026-03-05

## What's Done

### Backend (All 5 Phases Complete)

| Phase | Status | Files |
|-------|--------|-------|
| 1. Profile + Goal Setup | Done | `models/user_profile.py`, `routers/planner.py`, `config.py` |
| 2. Placement Test | Done | `models/placement.py`, `core/planner_ai.py` |
| 3. Daily Task Queue | Done | `models/daily_plan.py` (DailyPlan + TaskLog) |
| 4. Skill Adjustments | Done | `models/skill_snapshot.py`, `compute_adjustments()` in planner_ai |
| 5. Weekly Report + Roadmap | Done | `models/weekly_report.py` (WeeklyReport + Roadmap) |

**14 API endpoints** all tested and working:

```
GET    /planner/profile
PUT    /planner/profile
POST   /planner/enable
POST   /planner/disable
GET    /planner/status
GET    /planner/placement/start
POST   /planner/placement/submit
GET    /planner/today
POST   /planner/today/regenerate
POST   /planner/tasks/{id}/complete
POST   /planner/tasks/{id}/skip
GET    /planner/history?days=7
GET    /planner/report/weekly
GET    /planner/roadmap
POST   /planner/roadmap/regenerate
```

**Configurable AI provider** via env vars (defaults to DashScope/Qwen):
- `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL`, `AI_API_KEY`

**Database**: 7 new tables auto-created on startup (both SQLite and Supabase).

### Frontend (Basic UI Complete)

| Component | Status | Notes |
|-----------|--------|-------|
| Planner intro page | Done | Enable/disable toggle |
| Goal setup wizard | Done | Language, goal, timeline, daily minutes |
| Placement test | Done | 4-section MCQ + writing, section navigation |
| Placement results | Done | Scores, level, writing feedback |
| Daily plan view | Done | Task cards with Done/Skip, progress bar, coach message |
| History tab | Done | Past plans with completion % |
| Roadmap tab | Done | Monthly phases with skill weight bars |
| Weekly report tab | Done | Completion rate, score changes, AI summary |
| Sidebar entry | Done | "Learning Planner" with icon |
| Vite proxy | Done | `/planner` added to vite.config.ts |

**Files created/modified**:
- `frontend/src/pages/Planner.tsx` — main page (~500 lines, all states in one file)
- `frontend/src/api.ts` — 15 new typed fetch wrappers
- `frontend/src/App.tsx` — route added
- `frontend/src/components/Sidebar.tsx` — nav item added
- `frontend/src/components/icons.tsx` — PlannerIcon added
- `frontend/src/layouts/AppLayout.tsx` — title added
- `frontend/vite.config.ts` — proxy added

---

## Known Issues / TODO

### High Priority (Next Session)

- [ ] **Placement test "Skip" button**: Currently calls `updatePlannerProfile({current_level: "A1"})` but doesn't set `placement_completed=true` — backend `/planner/status` stays on "placement" step. Need a dedicated skip endpoint or update the PUT logic.
- [ ] **Task completion scores**: The "Done" button currently sends `{}` (no score). Need to either:
  - (a) Add a score input modal/prompt before marking complete, or
  - (b) Link tasks to actual module pages (e.g. clicking a `listening_quiz` task opens Listening page, and on completion auto-reports score back)
- [ ] **Daily plan caching**: Second visit to `/planner/today` returns cached plan (correct), but after disable→re-enable it may still have old plan for the same date

### Medium Priority

- [ ] **Task → Module deep links**: When user clicks a task like "listening_quiz", navigate to `/study/listening` and pass context (level, difficulty). On module completion, auto-call `/planner/tasks/{id}/complete` with score
- [ ] **Skill snapshot cron**: `SkillSnapshot` table exists but nothing writes to it yet. Need a daily job or trigger (after task completion) to compute rolling averages
- [ ] **Placement test audio**: Listening section currently shows text only (no TTS audio). Could integrate gTTS for the Dutch sentences
- [ ] **Writing section AI grading UX**: The writing grading takes 5-10s. Add a better loading state
- [ ] **Roadmap regenerate button**: UI has no button for this yet (endpoint exists)
- [ ] **Error handling polish**: Some API errors show raw messages. Add user-friendly error toasts

### Low Priority / Nice to Have

- [ ] i18n: Backend passes `language` param to AI prompts (zh/en works). Frontend strings are all English — defer to later
- [ ] Dashboard integration: Show planner status card on main Dashboard when planner is enabled
- [ ] Exam date countdown: Profile has `exam_date` field but no UI to set/display it
- [ ] Settings page: Add planner enable/disable toggle in Settings
- [ ] Task time tracking: Start a timer when user begins a task, auto-fill `time_spent_seconds`

---

## Architecture Quick Reference

```
backend/
├── config.py              # + AI_PROVIDER, AI_MODEL, AI_BASE_URL, AI_API_KEY
├── main.py                # + planner router + 7 model imports
├── core/
│   ├── qwen.py            # (unchanged) existing AI for listening
│   └── planner_ai.py      # NEW — all planner AI + deterministic adjustments
├── models/
│   ├── user_profile.py    # NEW — UserProfile (1:1 with User)
│   ├── placement.py       # NEW — PlacementResult
│   ├── daily_plan.py      # NEW — DailyPlan + TaskLog
│   ├── skill_snapshot.py  # NEW — SkillSnapshot
│   └── weekly_report.py   # NEW — WeeklyReport + Roadmap
└── routers/
    └── planner.py         # NEW — all 14 endpoints

frontend/src/
├── api.ts                 # + 15 planner API wrappers
├── App.tsx                # + /planner route
├── pages/
│   └── Planner.tsx        # NEW — full planner UI
├── components/
│   ├── Sidebar.tsx        # + Learning Planner nav item
│   └── icons.tsx          # + PlannerIcon
└── layouts/
    └── AppLayout.tsx      # + title mapping
```

## How to Test Locally

```bash
cd DutchA2

# Backend (needs DASHSCOPE_API_KEY in backend/.env)
PYTHONPATH=. .venv/bin/uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm run dev
# → http://localhost:5173/planner
```

To reset a user's planner data for a fresh test:
```bash
PYTHONPATH=. .venv/bin/python -c "
from backend.database import engine
from sqlmodel import Session, text
with Session(engine) as db:
    for t in ['tasklog','dailyplan','placementresult','skillsnapshot','weeklyreport','roadmap','userprofile']:
        db.exec(text(f'DELETE FROM {t} WHERE user_id = 1'))
    db.commit()
"
```
