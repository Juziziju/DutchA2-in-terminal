# Feature Spec: A2 Speaking Exam Sprint
**Feature ID**: F-SPEAKING-A2-01
**Priority**: P0
**Target**: Users with exam date within 8 weeks, beginner speaking level
**Exam format**: Computer-based, watch video clips → record answers, 35 min, 8 short + 8 long questions, scored on grammar / vocabulary / pronunciation

---

## 1. Overview

A focused exam-prep mode for the DUO A2 Speaking exam. The home screen presents three training blocks as a grid. Users work through them in sequence each day. All content is built around the actual A2 exam scene categories.

This is a separate mode from the general Adaptive Planner — activated when the user sets an exam date within 8 weeks and speaking as their target skill.

---

## 2. Home Screen: Three-Block Grid

```
┌─────────────────┬─────────────────┐
│                 │                 │
│   📖 Scene      │   🎙️ Record     │
│   Input         │   Practice      │
│                 │                 │
├─────────────────┴─────────────────┤
│                                   │
│        🤖 AI Review               │
│                                   │
└───────────────────────────────────┘
```

Each block shows: today's assigned content, estimated time, and completion status. Tapping a block enters that training module.

---

## 3. Block 1 — Scene Input (Look + Repeat)

### Purpose
Build vocabulary and sentence patterns for each exam scene before attempting to speak. No recording in this block.

### Content structure
The A2 speaking exam covers a fixed set of scene categories. All content in this block is organized by scene:

| Scene category | Examples |
|---|---|
| Self introduction | Name, age, country, job, family |
| Daily routine | Morning schedule, work, weekends |
| Shopping | Asking prices, sizes, complaints |
| Asking directions | Street, public transport, landmarks |
| Making appointments | Doctor, hairdresser, phone calls |
| Describing a photo | People, location, what's happening |
| Home and neighbourhood | Type of home, area, neighbours |
| Health and illness | Symptoms, pharmacy, GP visit |
| Work and study | Job description, colleagues, schedule |
| Leisure and hobbies | Sports, weekends, preferences |

### Per-scene content (built-in)
Each scene contains:
- **10–15 core vocabulary items** shown as word cards (Dutch + English/Chinese gloss)
- **5–8 model sentences** that match A2 exam response patterns
- **1 audio clip per sentence** for pronunciation reference (native speaker recording)
- **Repeat mode**: user taps a sentence, hears it, then taps to record their own repeat — no AI scoring here, just muscle memory

### Progression
Scenes unlock in order. User must complete Scene Input for a scene before that scene appears in Block 2.

### Session length
15–20 minutes per session. One scene per day in weeks 1–2; two scenes per day in weeks 3–4.

---

## 4. Block 2 — Record Practice (Exam Simulation)

### Purpose
Replicate the exact DUO exam conditions. User sees a scene prompt, has limited prep time, then records a response.

### Exam-accurate format
- **Short questions (8)**: 15 seconds prep → 30 seconds recording
- **Long questions (8)**: 30 seconds prep → 60 seconds recording
- Countdown timer visible during both prep and recording phases
- No option to replay the prompt during recording (matches real exam)

### Prompt types (matching DUO exam categories)
- Still image with a question overlay ("Describe what you see in this picture")
- Short text scenario ("You want to make a doctor's appointment. What do you say?")
- Reaction prompt ("Your neighbour asks if you want to join a sports club. How do you respond?")

### Content sourcing priority
1. **Built-in real exam questions** — sourced and formatted as the primary content bank
2. **AI-generated practice questions** — used to supplement when the built-in bank is exhausted for a scene, generated to match the same format and difficulty

### Session modes
- **Scene drill**: Practice all questions from one scene category back to back
- **Mixed drill**: Random questions across all unlocked scenes (used from week 5 onward)
- **Full mock exam**: 8 short + 8 long, timed, no interruptions — mirrors the real 35-minute exam

### Session length
20 minutes for scene drill; 35 minutes for full mock.

---

## 5. Block 3 — AI Review + Re-record

### Purpose
Surface the user's weakest responses, explain what went wrong, and have the user re-record until the response improves.

### How it works
After each Block 2 session, all recordings are queued for review. AI processes each recording via speech-to-text transcription, then evaluates the transcript against three criteria:

| Criterion | What AI checks |
|---|---|
| Vocabulary | Were scene-relevant words used? Were words misused or missing? |
| Grammar | Subject-verb agreement, word order, tense, articles |
| Completeness | Did the response actually answer the question? Was it long enough? |

Pronunciation is **not scored by AI** in this version — the speech-to-text transcription naturally surfaces severe pronunciation errors (words that get transcribed wrong). Flag these to the user without a numeric score.

### Review screen per recording
- Transcription of what the user said
- Original prompt shown again
- AI feedback in user's language: what was good, what was wrong, one concrete suggestion
- Model answer shown (from the built-in content bank or AI-generated)
- **Re-record button**: user can record again immediately, feedback refreshes

### Weak scene tracking
The system tracks per-scene average scores over time. Scenes where the user scores below 70% on two consecutive sessions are automatically added to the next day's Block 2 queue as priority items.

### Session length
10–15 minutes. Can be done async — user reviews at any time after completing Block 2.

---

## 6. Seven-Week Training Plan

Delivered automatically based on exam date. User sees a weekly plan overview and a daily task list.

| Week | Focus | Block 1 | Block 2 | Block 3 |
|---|---|---|---|---|
| 1–2 | Vocabulary + sentence patterns | 2 new scenes/day | Scene drill (just-unlocked scenes) | Review all recordings |
| 3–4 | Speaking fluency | 1 new scene/day | Scene drill + begin mixed drill | Focus re-records on weak scenes |
| 5–6 | Exam simulation | No new scenes | Mixed drill + 2× full mock exam | Weak scene priority queue |
| 7 | Polish only | Review saved model answers | Daily full mock exam | Re-record flagged items only |

---

## 7. Content Bank Requirements

### Built-in real exam questions (P0)
- Minimum 3 complete sets of A2 speaking exam questions (short + long)
- Each question includes: prompt text, prompt image or video still, model answer text, model answer audio
- Organized by scene category so they appear in the right Block 2 drill

### Model sentences for Block 1 (P0)
- 5–8 sentences per scene × 10 scenes = 50–80 sentences total
- Each sentence needs a native speaker audio recording
- Sentences must match A2 vocabulary level (≤ 2000 word vocabulary)

### AI-generated supplemental questions (P1)
- Triggered when user has exhausted built-in questions for a scene
- AI generates new prompts in the same format, at the same difficulty level
- Generated prompts are reviewed for quality before surfacing (either manually curated or auto-filtered by a second AI call)

---

## 8. Progress Indicators

Shown on the Sprint home screen:

- Days until exam (countdown)
- Scenes completed / total scenes
- Average score per scene (last 3 sessions)
- Weak scenes flagged for today
- Mock exam scores over time (line chart, last 4 mocks)

---

## 9. Edge Cases

| Situation | Handling |
|---|---|
| User skips Block 1 and goes straight to Block 2 | Allowed, but show a warning that scene vocabulary hasn't been studied |
| Recording fails or is too short | Prompt to re-record, do not send to AI review |
| User finishes all built-in content before exam | Switch to AI-generated questions, notify user |
| User scores >85% on a scene for 3 sessions | Mark scene as mastered, remove from daily queue, keep in mixed drill |
| Exam date passes | Offer to reset sprint with a new exam date or switch to general learning mode |

---

*Version: 1.0 | Date: 2026-03-05 | Scope: A2 Speaking exam sprint only*
