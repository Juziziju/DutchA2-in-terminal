"""AI wrapper for the learning advisor feature.

Uses the same AI client as planner_ai (AI_API_KEY + AI_BASE_URL).
Hardcoded model: qwen3.5-plus-2026-02-15.
"""

import json
import time

from backend.config import AI_API_KEY, AI_BASE_URL

ADVISOR_MODEL = "qwen3.5-plus-2026-02-15"


def _get_ai_client():
    from openai import OpenAI
    return OpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL)


def build_system_prompt(data: dict) -> str:
    """Assemble system prompt with static reference guide + dynamic learner data."""

    context_doc = """You are a personal Dutch language learning advisor for the DutchA2 Blitz app.
Analyze the learner's data below and provide specific, actionable advice.
Respond in the same language the user writes in (Chinese or English).

=== RESPONSE RULES ===
- ALWAYS respond with valid JSON: {"reply": "<your markdown advice>", "suggested_tasks": [...]}
- Be conversational and natural. Match the tone of the user's message.
- For casual messages (greetings, small talk, simple questions), reply casually. Do NOT push study advice or tasks unless the user asks for it.
- Only provide study recommendations when the user asks about their progress, what to study, or explicitly requests advice.
- Keep the "reply" under 150 words unless the user explicitly asks for a detailed breakdown.
- When giving study advice, lead with ONE key-insight sentence, then 2-4 action bullets.
- Use bullet points, NOT tables or numbered schedules.
- No emojis unless the user uses them first.
- When referencing app features, use the exact feature name and path from the APP FEATURES section below.
- Only include "suggested_tasks" when you are actively recommending study actions. For casual conversation, use "suggested_tasks": [].
- When your advice leads to specific study actions, include 1-3 tasks in "suggested_tasks":
  {"task_type": "<type>", "description": "<what to do>", "route": "<app path>"}
  Valid task_type -> route:
  - vocab_review -> /vocab-refresh
  - listening_quiz -> /study/listening
  - intensive -> /study/listening
  - speaking -> /study/speaking
  - reading -> /study/reading
  - writing -> /study/writing
  - shadow_reading -> /study/speaking
  - knm -> /study/knm
  - exam -> /exam
- If no tasks are relevant, use "suggested_tasks": []

=== APP FEATURES (refer users to these by name) ===
- Vocab Refresh (/vocab-refresh): Flashcard review with SM-2 spaced repetition. Shows due cards.
- Vocab Notebook (/vocab-notebook): Browse all vocab, see memorization level per word.
- Listening - Quiz (/study/listening): AI-generated dialogues with MC comprehension questions. Levels A1/A2/B1.
- Listening - Intensive (/study/listening): Dictation mode - listen and type. Trains precise hearing.
- Speaking (/study/speaking): Scene-based speaking with AI grading (vocab, grammar, completeness). Shadow reading mode available.
- Reading (/study/reading): Reading comprehension exercises.
- Writing (/study/writing): Dutch writing practice with AI feedback.
- KNM (/study/knm): Dutch society knowledge exercises.
- Mock Exam (/exam): Full exam simulation with 5 sections (LZ/LU/SC/SP/KNM).
- Learning Planner (/planner): AI-generated daily task plans, weekly reports, multi-month roadmap.
- Dashboard (/): Overview of streak, vocab stats, training summary, recent activity.

=== DATA REFERENCE GUIDE ===

**Flashcard SM-2 System:**
- Each vocab word has a progress record per direction (nl->en, en->nl)
- ease_factor (default 2.5): lower = harder for learner; interval: days until next review
- mastered: boolean, set when ease_factor stays high over many repetitions
- Levels: new -> hard -> learning -> familiar -> mastered

**Vocab Levels:**
- new: never reviewed | hard: reviewed 1-2x, ease < 2.2 | learning: reviewed 1-2x, ease >= 2.2 | familiar: 3+ reps, not mastered | mastered: flagged by SM-2

**Listening Modes:** quiz (MC comprehension) | intensive (dictation) | Levels: A1, A2, B1

**Speaking Scores:** vocabulary_score, grammar_score, completeness_score (each 0-100). Overall = average.

**Exam Sections:** LZ (Reading), LU (Listening), SC (Writing), SP (Speaking), KNM. Pass: each >= 60%.

**Planner:** goal: exam/everyday/work | level: A1-Low to A2 | weak_skills from placement test

**Streak:** consecutive days with any activity
"""

    # Build dynamic learner data section
    profile = data.get("profile", {})
    placement = data.get("placement", {})
    flashcard_stats = data.get("flashcard_stats", {})
    vocab_levels = data.get("vocab_levels", {})
    listening = data.get("listening", {})
    speaking = data.get("speaking", {})
    exam = data.get("exam", {})
    skills = data.get("skill_snapshots", [])
    weekly = data.get("weekly_report", {})
    streak = data.get("streak", 0)
    today = data.get("today", "")

    # New metrics
    vocab_categories = data.get("vocab_categories", [])
    listening_trend = data.get("listening_trend_7d")
    speaking_subscores = data.get("speaking_subscores", {})
    days_until_exam = data.get("days_until_exam")
    planner_rate = data.get("planner_completion_rate_7d")
    most_practiced = data.get("most_practiced_skill")
    least_practiced = data.get("least_practiced_skill")
    review_consistency = data.get("review_consistency_30d", 0)

    learner_data = f"""
=== LEARNER PROFILE ===
Goal: {profile.get('goal', 'N/A')} | Level: {profile.get('current_level', 'N/A')} | Timeline: {profile.get('timeline_months', 'N/A')} months | Daily: {profile.get('daily_minutes', 'N/A')} min
Weak skills: {profile.get('weak_skills', [])} | Exam date: {profile.get('exam_date', 'N/A')} | Days until exam: {days_until_exam if days_until_exam is not None else 'N/A'}
Start date: {profile.get('start_date', 'N/A')}

=== PLACEMENT RESULTS ===
Vocab: {placement.get('vocab_score', 'N/A')}/5 | Listening: {placement.get('listening_score', 'N/A')}/3 | Reading: {placement.get('reading_score', 'N/A')}/3 | Writing: {placement.get('writing_score', 'N/A')}/100
Overall level: {placement.get('overall_level', 'N/A')}

=== CURRENT STATS ===
Streak: {streak} days | Today: {today}

Flashcards: {flashcard_stats.get('total_cards', 0)} total | {flashcard_stats.get('mastered', 0)} mastered | {flashcard_stats.get('due_today', 0)} due today | {flashcard_stats.get('total_reviewed', 0)} reviewed
Vocab levels: {vocab_levels.get('mastered', 0)} mastered, {vocab_levels.get('familiar', 0)} familiar, {vocab_levels.get('learning', 0)} learning, {vocab_levels.get('hard', 0)} hard, {vocab_levels.get('new', 0)} new
Vocab review consistency: {review_consistency}/30 days with reviews in last month

Listening (30d): {listening.get('total_sessions', 0)} sessions | Quiz avg: {listening.get('avg_score_quiz', 'N/A')}% ({listening.get('quiz_sessions', 0)} sessions) | Intensive avg: {listening.get('avg_score_intensive', 'N/A')}% ({listening.get('intensive_sessions', 0)} sessions)
Listening trend (7d vs prior 7d): {f"{listening_trend:+.1f}% change" if listening_trend is not None else "N/A"}

Speaking (30d): {speaking.get('total_sessions', 0)} sessions | Avg score: {speaking.get('avg_score', 'N/A')}%
Speaking sub-scores (30d avg): vocab {speaking_subscores.get('vocabulary', 'N/A')}% | grammar {speaking_subscores.get('grammar', 'N/A')}% | completeness {speaking_subscores.get('completeness', 'N/A')}%

Latest exam: avg {exam.get('avg_score', 'N/A')}% | {'Passed' if exam.get('passed') else 'Not passed'} | Scores: {exam.get('scores', 'N/A')}

Planner task completion (7d): {f"{planner_rate}%" if planner_rate is not None else "N/A"}
Most practiced skill (30d): {most_practiced or 'N/A'} | Least practiced: {least_practiced or 'N/A'}
"""

    # Weakest vocab categories
    if vocab_categories:
        learner_data += "\nWeakest vocab categories:\n"
        for vc in vocab_categories:
            learner_data += f"- {vc['category']}: {vc['mastered']}/{vc['total']} mastered\n"

    learner_data += "\n=== SKILL SNAPSHOTS ===\n"
    for snap in skills:
        learner_data += f"{snap['skill']}: {snap['assessed_level']} (avg {snap['avg_score']}%)\n"

    if weekly:
        learner_data += f"""
=== LATEST WEEKLY REPORT ===
Completion: {weekly.get('completion_rate', 'N/A')}% | Focus next week: {weekly.get('focus_next_week', 'N/A')}
Summary: {weekly.get('summary_text', 'N/A')}
"""

    return context_doc + learner_data


def _call_advisor_llm(system_prompt: str, user_message: str) -> str:
    """Call LLM and return raw content string. Retries once on failure."""
    client = _get_ai_client()
    last_err = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=ADVISOR_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.6,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)
    raise RuntimeError(f"Advisor AI call failed after 2 attempts: {last_err}")


def stream_advisor_response(data: dict, user_message: str):
    """Generator that yields text chunks from the LLM via streaming."""
    client = _get_ai_client()
    system_prompt = build_system_prompt(data)
    stream = client.chat.completions.create(
        model=ADVISOR_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.6,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield delta.content


def get_advisor_response(data: dict, user_message: str) -> str:
    """Call LLM with assembled context + user question. Returns markdown string."""
    system_prompt = build_system_prompt(data)
    return _call_advisor_llm(system_prompt, user_message)


def get_advisor_response_structured(data: dict, user_message: str) -> dict:
    """Call LLM and parse structured JSON response with reply + suggested_tasks.

    Falls back gracefully if the LLM returns plain text instead of JSON.
    """
    system_prompt = build_system_prompt(data)
    raw = _call_advisor_llm(system_prompt, user_message)

    # Strip markdown fences if present
    stripped = raw.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        stripped = "\n".join(lines[1:end])

    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict) and "reply" in parsed:
            return parsed
    except (json.JSONDecodeError, ValueError):
        pass

    # Fallback: plain text response
    return {"reply": raw, "suggested_tasks": []}
