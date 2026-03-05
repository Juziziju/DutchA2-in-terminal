# Feature Spec: AI Adaptive Learning Planner
**Feature ID**: F-PLANNER-01
**Priority**: P0
**Target Users**: English and Chinese speakers learning Dutch

---

## 1. Overview

Users set a learning goal and available daily time. The system runs a placement test to assess current level, generates a personalized daily task queue, and dynamically adjusts the plan based on daily performance.

---

## 2. AI Provider

Currently testing with Qwen. Provider should be configurable via environment variable so it can be swapped without touching feature logic. All AI calls in this feature go through a single shared wrapper.

---

## 3. Language & Internationalization

**Supported languages**: English (default at signup), Chinese Simplified
**User control**: Selected during registration; switchable anytime in Settings
**Scope**: All UI strings, AI-generated responses, and coach messages follow the user's language setting

Language selection is the **first screen after account creation**, before any onboarding questions. Switching language in Settings takes effect immediately across the entire app.

All UI strings must use i18n keys. A Chinese translation file should be maintained as a backup alongside the English source.

---

## 4. User Flow

### Step 0: Language Selection (Registration)

First screen after account creation. User picks English or Chinese. Saved to profile immediately.

---

### Step 1: Goal Setup (Onboarding, one-time)

User answers 3 questions:

| Question | Options |
|---|---|
| What's your learning goal? | Pass the A2 inburgering exam / Everyday communication / Work situations |
| When do you want to reach it? | 3 months / 6 months / 12 months |
| How much time can you study daily? | 30 min / 1 hour / 1.5 hours / 2+ hours |

---

### Step 2: Placement Test (10 min, one-time)

4 dimensions, 20 questions total. Results determine starting level and weak skills.

**Vocabulary (5 questions)** — Multiple choice: Dutch word → correct meaning in user's language

**Listening (3 questions)** — Play a 10–15s dialogue, answer a comprehension question

**Reading (3 questions)** — 50-word passage, answer comprehension questions

**Writing (1 question)** — User writes 2–3 sentences in Dutch introducing themselves. AI scores on: vocabulary accuracy, sentence completeness, basic grammar. Feedback shown in user's language.

**Output level tags**:
- A1-Low — beginner, vocab under 200 words
- A1 — basic, vocab 200–500
- A1-High — vocab 500+, but weak in speaking/writing
- A2-Entry — partial A2 ability, needs consolidation

---

### Step 3: 6-Month Roadmap Generation

AI generates a full plan based on: current level, goal, timeline, daily time available, and weak skills from the placement test. Output includes phase milestones by month, weekly skill allocation percentages, and the Day 1 task queue.

---

### Step 4: Daily Task Queue

Shown on the home screen each day. Example for A1 level, A2 goal, 60 min/day:

  Today's Focus: Build your listening-speaking loop

  ✅ Shadow reading × 2 clips       [15 min]
  ⬜ Intensive listening × 1 clip   [15 min]
  ⬜ Graded reading × 1 article     [10 min]
  ⬜ Writing journal (3 sentences)  [10 min]
  ⬜ Vocabulary review              [10 min]

  Coach tip: Speaking is your weakest area — don't skip shadow reading today.

Each task card links directly to the corresponding training module. Tasks can be marked complete or swiped to skip.

---

### Step 5: Dynamic Adjustment (Daily)

After each day, the system records completion status, scores per module, and actual time spent. The next day's plan is generated based on recent performance:

| Trigger | Adjustment |
|---|---|
| Listening error rate >50% for 2 days | More listening time, lower material difficulty |
| Writing score >80 for 3 consecutive days | Upgrade to 4-sentence goal, introduce more complex patterns |
| Speaking tasks skipped 3 days in a row | Ask why; offer a shorter 5-min alternative |
| Progress behind the 6-month plan | Rebalance skill weights, show a progress warning |
| One skill improving consistently | Auto-upgrade that skill's material difficulty (A1 → A2 content) |

---

## 5. AI Behavior Spec

All AI responses must be in the user's selected language.

**Placement test writing scoring**
Input: user's Dutch writing sample
Output: score (0–100), level tag, list of errors with explanations, summary of strengths

**Daily plan generation**
Input: current level, goal, days remaining, daily time available, yesterday's performance, skill score trends
Output: today's focus headline, ordered task list with type / description / duration / difficulty, coach message, progress note vs. plan

**Weekly report**
Input: 7 days of task completion and scores
Output: completion rate, score changes by skill, biggest improvement, one focus area for next week, plan adjustment suggestion. Under 150 words. Friendly and encouraging tone.

---

## 6. Data to Track Per User

- Language preference
- Goal, target timeline, daily time budget
- Current level and weak skills (from placement test)
- Start date and exam date (if set)
- Per-task: type, date, completion status, score, actual time spent
- Per-skill: daily average score, assessed level over time

---

## 7. UI Requirements

**Daily Task Page**
- Card list; tap to enter module, swipe left to skip
- Progress bar and streak counter at top
- Celebration animation on full completion

**Progress Overview Page**
- 6-month milestone timeline, current position highlighted
- Radar chart: listening / speaking / reading / writing scores
- Exam countdown (if date set)
- Weekly check-in calendar heatmap

**Language Toggle**
- Accessible from Settings and top navigation
- Switching re-renders all UI strings immediately
- AI responses in subsequent calls use the new language

---

## 8. Edge Cases

| Situation | Handling |
|---|---|
| Inactive for 3+ days | Push notification; regenerate a lighter queue at 50% time |
| Reaches A2 level early | Prompt to register for exam; offer exam prep mode |
| Changes daily time budget | Settings update triggers immediate plan recalculation |
| All tasks skipped in a day | No penalty; next day generates normally, nothing stacks |
| AI call fails | Show cached previous day's plan with a retry prompt |

---

*Version: 1.3 | Date: 2026-03-05*
