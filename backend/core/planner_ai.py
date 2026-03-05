"""AI wrapper functions for the adaptive learning planner.

Uses configurable AI provider (defaults to DashScope/Qwen).
Same patterns as qwen.py: retry logic, JSON validation, markdown fence stripping.
"""

import json
import time

from backend.config import AI_API_KEY, AI_BASE_URL, AI_MODEL


def _get_ai_client():
    """Configurable AI client from env vars."""
    from openai import OpenAI

    return OpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL)


def _strip_markdown_fences(raw: str) -> str:
    """Remove ```json ... ``` fences if present."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        raw = "\n".join(lines[1:end])
    return raw


def _call_ai(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
    """Call AI and return raw content string. Retries once on failure."""
    client = _get_ai_client()
    last_err = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=AI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)
    raise RuntimeError(f"AI call failed after 2 attempts: {last_err}")


def _call_ai_json(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> dict:
    """Call AI, strip markdown fences, parse JSON. Retries once."""
    raw = _call_ai(system_prompt, user_prompt, temperature)
    raw = _strip_markdown_fences(raw)
    return json.loads(raw)


# ── Phase 2: Placement Test ─────────────────────────────────────────────────


def generate_placement_questions(language: str = "en") -> dict:
    """Generate placement test questions via AI.

    Returns {
        vocab: [{question, options: {A,B,C,D}, answer}] (5 items),
        listening: [{text, question, options: {A,B,C,D}, answer}] (3 items),
        reading: [{passage, question, options: {A,B,C,D}, answer}] (3 items),
        writing_prompt: str
    }
    """
    lang_instruction = "Respond in Chinese." if language == "zh" else "Respond in English."
    system_prompt = f"""You are a Dutch language placement test generator.
Generate a placement test to assess a learner's Dutch level (A1 to A2).
{lang_instruction}
Return ONLY valid JSON with no markdown fences.

Schema:
{{
  "vocab": [
    {{"question": "What does 'huis' mean?", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "answer": "A"}},
    ... (5 questions, mix of A1 and A2 vocabulary)
  ],
  "listening": [
    {{"text": "Dutch sentence to read aloud", "question": "What does the speaker mean?", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "answer": "B"}},
    ... (3 questions, short Dutch sentences with comprehension questions)
  ],
  "reading": [
    {{"passage": "Short Dutch paragraph (2-3 sentences)", "question": "Question about the passage", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "answer": "C"}},
    ... (3 questions, ranging from A1 to A2 difficulty)
  ],
  "writing_prompt": "Write 3-5 sentences in Dutch about your daily routine."
}}

Requirements:
- Vocabulary questions: mix basic (A1) and intermediate (A2) words
- Listening: Dutch sentences testing comprehension (will be displayed as text for now)
- Reading: short passages with comprehension questions
- Writing prompt: open-ended, suitable for any level
- All question/option text in Dutch, explanations in the learner's language"""

    return _call_ai_json(system_prompt, "Generate a Dutch placement test now.", temperature=0.8)


def score_writing(text: str, language: str = "en") -> dict:
    """AI scores Dutch writing.

    Returns {score: 0-100, level_tag: "A1-Low"|..., errors: [...], strengths: [...]}
    """
    lang_instruction = "Provide feedback in Chinese." if language == "zh" else "Provide feedback in English."
    system_prompt = f"""You are a Dutch language writing assessor.
Score the following Dutch writing sample on a scale of 0-100.
{lang_instruction}
Return ONLY valid JSON with no markdown fences.

Schema:
{{
  "score": 65,
  "level_tag": "A1-High",
  "errors": ["Subject-verb agreement error in sentence 2", ...],
  "strengths": ["Good use of basic vocabulary", ...]
}}

Scoring guide:
- 0-20: No meaningful Dutch (A1-Low)
- 21-40: Very basic, many errors (A1)
- 41-60: Basic sentences with some errors (A1-High)
- 61-80: Decent A2 level writing (A2-Entry)
- 81-100: Solid A2 writing (A2)"""

    return _call_ai_json(
        system_prompt,
        f"Score this Dutch writing sample:\n\n{text}",
        temperature=0.3,
    )


def determine_level(scores: dict) -> tuple[str, list[str]]:
    """Pure logic (no AI). Weighted average -> level tag + weak_skills list.

    scores: {vocab_score: 0-5, listening_score: 0-3, reading_score: 0-3, writing_score: 0-100}
    Returns: (level_tag, weak_skills)
    """
    # Normalize all scores to 0-100
    vocab_pct = (scores.get("vocab_score", 0) / 5) * 100
    listening_pct = (scores.get("listening_score", 0) / 3) * 100
    reading_pct = (scores.get("reading_score", 0) / 3) * 100
    writing_pct = scores.get("writing_score", 0)

    # Weighted average: vocab 25%, listening 25%, reading 25%, writing 25%
    weighted = vocab_pct * 0.25 + listening_pct * 0.25 + reading_pct * 0.25 + writing_pct * 0.25

    # Determine level
    if weighted < 25:
        level = "A1-Low"
    elif weighted < 45:
        level = "A1"
    elif weighted < 65:
        level = "A1-High"
    elif weighted < 80:
        level = "A2-Entry"
    else:
        level = "A2"

    # Identify weak skills (below 50% normalized)
    weak = []
    if vocab_pct < 50:
        weak.append("vocabulary")
    if listening_pct < 50:
        weak.append("listening")
    if reading_pct < 50:
        weak.append("reading")
    if writing_pct < 50:
        weak.append("writing")

    return level, weak


# ── Phase 3: Daily Plan Generation ──────────────────────────────────────────


def generate_daily_plan(
    profile: dict,
    recent_performance: dict,
    days_since_start: int,
    language: str = "en",
) -> dict:
    """Generate a personalized daily task plan.

    profile: {goal, level, timeline_months, daily_minutes, weak_skills}
    recent_performance: {tasks_completed, tasks_skipped, avg_scores, streak_days}
    days_since_start: int

    Returns {
        focus_headline: str,
        tasks: [{type, description, duration_minutes, difficulty}],
        coach_message: str,
        progress_note: str
    }
    """
    lang_instruction = "Respond in Chinese." if language == "zh" else "Respond in English."
    system_prompt = f"""You are an adaptive Dutch language learning coach.
Generate a personalized daily task plan based on the learner's profile and recent performance.
{lang_instruction}
Return ONLY valid JSON with no markdown fences.

Schema:
{{
  "focus_headline": "Today: Listening & Vocabulary Review",
  "tasks": [
    {{
      "type": "vocab_review",
      "description": "Review 20 flashcards focusing on weak words",
      "duration_minutes": 15,
      "difficulty": "A1"
    }},
    {{
      "type": "listening_quiz",
      "description": "Complete a listening comprehension exercise",
      "duration_minutes": 10,
      "difficulty": "A2"
    }},
    ...
  ],
  "coach_message": "Great job yesterday! Let's focus on listening today.",
  "progress_note": "Day 15 of 180. You're making steady progress!"
}}

Valid task types: "vocab_review", "listening_quiz", "intensive", "reading", "writing", "shadow_reading"
Valid difficulties: "A1", "A1-High", "A2-Entry", "A2"

Rules:
- Total task duration must fit within the daily_minutes budget
- Prioritize weak_skills but include variety
- If recent scores are low in a skill, add more practice at lower difficulty
- If recent scores are high, gradually increase difficulty
- Include at least one vocab_review task per day
- Keep tasks achievable and encouraging"""

    user_prompt = f"""Learner profile:
- Goal: {profile.get('goal', 'everyday')}
- Current level: {profile.get('level', 'A1')}
- Timeline: {profile.get('timeline_months', 6)} months
- Daily budget: {profile.get('daily_minutes', 30)} minutes
- Weak skills: {profile.get('weak_skills', [])}
- Day {days_since_start} of plan

Recent 7-day performance:
- Tasks completed: {recent_performance.get('tasks_completed', 0)}
- Tasks skipped: {recent_performance.get('tasks_skipped', 0)}
- Average scores: {recent_performance.get('avg_scores', {})}
- Streak days: {recent_performance.get('streak_days', 0)}
- Adjustments: {recent_performance.get('adjustments', {})}

Generate today's task plan."""

    return _call_ai_json(system_prompt, user_prompt, temperature=0.7)


# ── Phase 4: Skill Adjustments (deterministic) ──────────────────────────────


def compute_adjustments(
    profile: dict,
    task_logs_7d: list[dict],
    skill_snapshots_14d: list[dict],
) -> dict:
    """Detect trigger conditions and compute adjustments.

    Returns {triggers_fired: [...], level_changes: {...}, time_rebalance: {...}}
    """
    triggers = []
    level_changes = {}
    time_rebalance = {}

    # Group task logs by type and day
    from collections import defaultdict

    by_type_day: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for log in task_logs_7d:
        by_type_day[log.get("task_type", "")][log.get("date", "")].append(log)

    # Check listening error rate > 50% for 2+ days
    listening_bad_days = 0
    for day_logs in by_type_day.get("listening_quiz", {}).values():
        scores = [l.get("score", 0) for l in day_logs if l.get("score") is not None]
        if scores and (sum(scores) / len(scores)) < 50:
            listening_bad_days += 1
    if listening_bad_days >= 2:
        triggers.append("listening_struggling")
        level_changes["listening"] = "decrease"

    # Check writing score > 80 for 3+ days
    writing_good_days = 0
    for day_logs in by_type_day.get("writing", {}).values():
        scores = [l.get("score", 0) for l in day_logs if l.get("score") is not None]
        if scores and (sum(scores) / len(scores)) > 80:
            writing_good_days += 1
    if writing_good_days >= 3:
        triggers.append("writing_excelling")
        level_changes["writing"] = "increase"

    # Check skipped tasks (any type skipped 3+ days)
    skip_counts: dict[str, int] = defaultdict(int)
    for log in task_logs_7d:
        if log.get("status") == "skipped":
            skip_counts[log.get("task_type", "")] += 1
    for task_type, count in skip_counts.items():
        if count >= 3:
            triggers.append(f"{task_type}_frequently_skipped")
            time_rebalance[task_type] = "reduce"

    # Check inactivity (no completed tasks in last 3 days)
    from datetime import date, timedelta

    recent_dates = set()
    today = date.today()
    for log in task_logs_7d:
        if log.get("status") == "completed":
            recent_dates.add(log.get("date", ""))

    recent_3_days = {(today - timedelta(days=i)).isoformat() for i in range(3)}
    if not recent_dates.intersection(recent_3_days) and task_logs_7d:
        triggers.append("inactive_3_days")
        time_rebalance["overall"] = "lighten"

    # Check skill snapshots for trends
    for snap in skill_snapshots_14d:
        skill = snap.get("skill", "")
        if snap.get("avg_score", 0) > 85:
            if skill not in level_changes:
                level_changes[skill] = "increase"
        elif snap.get("avg_score", 0) < 30:
            if skill not in level_changes:
                level_changes[skill] = "decrease"

    return {
        "triggers_fired": triggers,
        "level_changes": level_changes,
        "time_rebalance": time_rebalance,
    }


# ── Phase 5: Weekly Report + Roadmap ────────────────────────────────────────


def generate_weekly_report(
    task_logs_7d: list[dict],
    skill_snapshots_7d: list[dict],
    profile: dict,
    language: str = "en",
) -> dict:
    """Generate a weekly progress report.

    Returns {completion_rate, score_changes, biggest_improvement, focus_next_week, summary_text}
    Under 150 words.
    """
    lang_instruction = "Respond in Chinese." if language == "zh" else "Respond in English."
    system_prompt = f"""You are a Dutch language learning coach writing a weekly progress report.
{lang_instruction}
Return ONLY valid JSON with no markdown fences.

Schema:
{{
  "completion_rate": 85,
  "score_changes": {{"listening": "+5", "vocabulary": "+3", "writing": "-2"}},
  "biggest_improvement": "listening",
  "focus_next_week": "writing",
  "summary_text": "Great week! You completed 85% of your tasks..."
}}

Rules:
- summary_text must be under 150 words
- Be encouraging but honest
- Highlight specific achievements
- Give concrete advice for next week"""

    completed = sum(1 for t in task_logs_7d if t.get("status") == "completed")
    total = len(task_logs_7d)
    completion_rate = round(completed / total * 100) if total else 0

    user_prompt = f"""Weekly data:
- Tasks: {completed}/{total} completed ({completion_rate}%)
- Task breakdown: {json.dumps(task_logs_7d[:20])}
- Skill snapshots: {json.dumps(skill_snapshots_7d)}
- Goal: {profile.get('goal', 'everyday')}
- Level: {profile.get('level', 'A1')}

Generate the weekly report."""

    return _call_ai_json(system_prompt, user_prompt, temperature=0.5)


def generate_roadmap(
    profile: dict,
    placement_result: dict,
    language: str = "en",
) -> dict:
    """Generate a multi-month learning roadmap.

    Returns {phases: [{month, milestone, skill_weights: {listening: 30, ...}}]}
    """
    lang_instruction = "Respond in Chinese." if language == "zh" else "Respond in English."
    system_prompt = f"""You are a Dutch language curriculum designer.
Create a personalized learning roadmap based on the learner's placement test results and goals.
{lang_instruction}
Return ONLY valid JSON with no markdown fences.

Schema:
{{
  "phases": [
    {{
      "month": 1,
      "milestone": "Build core A1 vocabulary and basic listening skills",
      "skill_weights": {{"vocabulary": 35, "listening": 30, "reading": 20, "writing": 15}}
    }},
    ...
  ]
}}

Rules:
- Number of phases = timeline_months
- Each phase has a clear milestone
- skill_weights must sum to 100
- Prioritize weak skills in early phases
- Gradually shift to balanced practice
- Final phase should prepare for the goal (exam/everyday/work)"""

    user_prompt = f"""Learner profile:
- Goal: {profile.get('goal', 'everyday')}
- Timeline: {profile.get('timeline_months', 6)} months
- Current level: {profile.get('level', 'A1-Low')}
- Weak skills: {profile.get('weak_skills', [])}
- Placement scores: {json.dumps(placement_result)}

Generate the learning roadmap."""

    return _call_ai_json(system_prompt, user_prompt, temperature=0.5)
