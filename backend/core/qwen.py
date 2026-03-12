"""Qwen LLM calls via DashScope — extracted from scripts/listening.py."""

import json
import os
import time

from backend.config import DASHSCOPE_API_KEY

CONTENT_MODEL = os.getenv("CONTENT_MODEL", "qwen-plus")

LEVEL_CONFIGS = {
    "A1": {
        "dialogue_lines": "6-8",
        "questions": 3,
        "description": "Simple present tense, basic vocabulary, short sentences. Topics: greetings, family, shopping, weather.",
    },
    "A2": {
        "dialogue_lines": "8-12",
        "questions": 4,
        "description": "Present and past tense, everyday topics like appointments, travel, daily routines.",
    },
    "B1": {
        "dialogue_lines": "10-14",
        "questions": 5,
        "description": "Varied tenses (present, past, future, conditional), complex sentence structures, abstract topics like opinions, plans, news.",
    },
}


def _build_system_prompt(level: str = "A2", topic: str = "") -> str:
    cfg = LEVEL_CONFIGS.get(level, LEVEL_CONFIGS["A2"])
    topic_line = f"\n- The dialogue MUST be about: {topic}" if topic else ""
    return f"""You are a Dutch language teacher. Generate a Dutch {level}-level listening exercise.
Return ONLY valid JSON with no markdown fences, no explanation, just the raw JSON object.

Schema:
{{
  "topic": "string (topic in English)",
  "speakers": ["Name1", "Name2"],
  "dialogue": [
    {{"speaker": "Name1", "text": "Dutch sentence", "english": "English translation"}},
    ...
  ],
  "questions": [
    {{
      "question": "Dutch question?",
      "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "answer": "A"
    }},
    ...
  ]
}}

Requirements:
- 2 speakers, {cfg['dialogue_lines']} dialogue lines total
- {level} level Dutch throughout: {cfg['description']}
- Each dialogue line must include an "english" field with a natural English translation
- Exactly {cfg['questions']} multiple-choice questions (A/B/C/D) written in Dutch
- The answer field must be one of: A, B, C, D{topic_line}"""


def _get_client():
    from openai import OpenAI
    return OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


def _call_qwen(level: str = "A2", topic: str = "") -> str:
    client = _get_client()
    topic_part = f" about: {topic}." if topic else "."
    user_msg = (
        f"Create a Dutch {level} listening dialogue{topic_part} "
        f"Return only valid JSON."
    )
    response = client.chat.completions.create(
        model=CONTENT_MODEL,
        messages=[
            {"role": "system", "content": _build_system_prompt(level, topic)},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.9,
    )
    return response.choices[0].message.content.strip()


def _validate_dialogue(data: dict, level: str = "A2"):
    cfg = LEVEL_CONFIGS.get(level, LEVEL_CONFIGS["A2"])
    expected_questions = cfg["questions"]

    required_top = {"topic", "speakers", "dialogue", "questions"}
    missing = required_top - set(data.keys())
    if missing:
        raise ValueError(f"Missing top-level keys: {missing}")
    if not isinstance(data["dialogue"], list) or len(data["dialogue"]) < 2:
        raise ValueError("dialogue must be a list with at least 2 entries")
    for i, line in enumerate(data["dialogue"]):
        if "speaker" not in line or "text" not in line or "english" not in line:
            raise ValueError(f"dialogue[{i}] missing speaker/text/english")
    if not isinstance(data["questions"], list) or len(data["questions"]) != expected_questions:
        raise ValueError(
            f"questions must be a list of exactly {expected_questions} items, got {len(data.get('questions', []))}"
        )
    for i, q in enumerate(data["questions"]):
        for key in ("question", "options", "answer"):
            if key not in q:
                raise ValueError(f"questions[{i}] missing '{key}'")
        if set(q["options"].keys()) != {"A", "B", "C", "D"}:
            raise ValueError(f"questions[{i}] options must have keys A, B, C, D")
        if q["answer"] not in ("A", "B", "C", "D"):
            raise ValueError(f"questions[{i}] answer must be A/B/C/D")


def generate_dialogue(level: str = "A2", topic: str = "") -> dict:
    """Call Qwen, parse + validate JSON. Retries once on failure."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    last_err = None
    for attempt in range(2):
        try:
            raw = _call_qwen(level, topic)
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(raw)
            _validate_dialogue(data, level)
            return data
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)

    raise RuntimeError(f"Dialogue generation failed after 2 attempts: {last_err}")


INTENSIVE_TYPE_CONFIGS = {
    "dialogue": {
        "description": "a natural conversation between 2 speakers",
        "lines": {"A1": "6-8", "A2": "8-12", "B1": "10-14"},
        "schema_hint": '"speakers": ["Name1", "Name2"], each line has "speaker"',
    },
    "news": {
        "description": "a short news report read by a single presenter",
        "lines": {"A1": "5-7", "A2": "7-10", "B1": "9-12"},
        "schema_hint": '"speakers": ["Presenter"], all lines have speaker "Presenter"',
    },
    "article": {
        "description": "an informative article narrated by a reader",
        "lines": {"A1": "6-8", "A2": "8-11", "B1": "10-14"},
        "schema_hint": '"speakers": ["Narrator"], all lines have speaker "Narrator"',
    },
}


def _build_intensive_prompt(level: str = "A2", content_type: str = "dialogue", topic: str = "") -> str:
    lvl_cfg = LEVEL_CONFIGS.get(level, LEVEL_CONFIGS["A2"])
    type_cfg = INTENSIVE_TYPE_CONFIGS.get(content_type, INTENSIVE_TYPE_CONFIGS["dialogue"])
    line_range = type_cfg["lines"].get(level, type_cfg["lines"]["A2"])
    topic_line = f"\n- The content MUST be about: {topic}" if topic else ""
    return f"""You are a Dutch language teacher. Generate {type_cfg['description']} in Dutch at {level} level for a dictation exercise.
Return ONLY valid JSON with no markdown fences, no explanation, just the raw JSON object.

Schema:
{{
  "topic": "string (topic in English)",
  {type_cfg['schema_hint']},
  "lines": [
    {{"speaker": "...", "text": "Dutch sentence", "english": "English translation"}},
    ...
  ]
}}

Requirements:
- {line_range} lines total
- {level} level Dutch throughout: {lvl_cfg['description']}
- Each line must include an "english" field with a natural English translation
- Each sentence should be a natural, complete thought (not too long, suitable for dictation){topic_line}"""


def _call_qwen_intensive(level: str = "A2", content_type: str = "dialogue", topic: str = "") -> str:
    client = _get_client()
    topic_part = f" about: {topic}." if topic else "."
    user_msg = (
        f"Create a Dutch {level} {content_type} for dictation{topic_part} "
        f"Return only valid JSON."
    )
    response = client.chat.completions.create(
        model=CONTENT_MODEL,
        messages=[
            {"role": "system", "content": _build_intensive_prompt(level, content_type, topic)},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.9,
    )
    return response.choices[0].message.content.strip()


def _validate_intensive(data: dict):
    required_top = {"topic", "speakers", "lines"}
    missing = required_top - set(data.keys())
    if missing:
        raise ValueError(f"Missing top-level keys: {missing}")
    if not isinstance(data["lines"], list) or len(data["lines"]) < 2:
        raise ValueError("lines must be a list with at least 2 entries")
    for i, line in enumerate(data["lines"]):
        if "speaker" not in line or "text" not in line or "english" not in line:
            raise ValueError(f"lines[{i}] missing speaker/text/english")


def generate_intensive(level: str = "A2", content_type: str = "dialogue", topic: str = "") -> dict:
    """Generate intensive listening content. Retries once on failure."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    last_err = None
    for attempt in range(2):
        try:
            raw = _call_qwen_intensive(level, content_type, topic)
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(raw)
            _validate_intensive(data)
            return data
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)

    raise RuntimeError(f"Intensive generation failed after 2 attempts: {last_err}")


def get_explanation(data: dict, questions: list[dict], user_answers: list[str], level: str = "A2") -> str:
    """Call Qwen to explain quiz results. Returns the full explanation string."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    client = _get_client()

    # Detect if this is a reading passage or listening dialogue
    is_reading = len(data.get("dialogue", [])) == 1 and data["dialogue"][0].get("speaker") == "Text"

    if is_reading:
        source_label = "Reading passage"
        source_text = (
            f"Dutch text:\n{data['dialogue'][0]['text']}\n\n"
            f"English translation:\n{data['dialogue'][0].get('english', '')}"
        )
    else:
        source_label = "Listening dialogue"
        source_text = "Dialogue:\n" + "\n".join(
            f"{line['speaker']}: {line['text']} ({line.get('english', '')})"
            for line in data["dialogue"]
        )

    qa_summary = ""
    for i, (q, ua) in enumerate(zip(questions, user_answers), 1):
        correct = q["answer"]
        correct_text = q["options"][correct]
        user_text = q["options"].get(ua, "(no answer)")
        status = "correct" if ua == correct else "incorrect"
        question_text = q.get("question") or q.get("question_nl", "")
        qa_summary += (
            f"Q{i}: {question_text}\n"
            f"  User answered {ua}) {user_text} — {status}\n"
            f"  Correct answer: {correct}) {correct_text}\n\n"
        )

    prompt = (
        f"Dutch {level} {source_label.lower()}. Topic: {data['topic']}\n\n"
        f"{source_text}\n\n"
        f"Results:\n{qa_summary}"
        f"For EACH question (correct or wrong), provide:\n"
        f"1. Whether the user was correct or incorrect\n"
        f"2. Quote the exact relevant Dutch sentence(s) from the {'passage' if is_reading else 'dialogue'} (use quotation marks)\n"
        f"3. Provide the English translation of the quoted sentence(s)\n"
        f"4. Explain WHY the correct answer follows from that quote\n\n"
        f"Format each answer as:\n"
        f"Q1: Correct/Incorrect\n"
        f"Evidence: \"[Dutch quote from the text]\" — \"[English translation]\"\n"
        f"Explanation: [why the correct answer follows from this evidence]\n\n"
        f"IMPORTANT:\n"
        f"- You MUST include a direct Dutch quote and its English translation for EVERY question\n"
        f"- Do NOT invent grammar terminology or make up rules\n"
        f"- Just quote the relevant text, translate it, and explain the meaning\n"
        f"- Be concise but thorough. No encouragement or filler. English only."
    )

    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )
    return response.choices[0].message.content.strip()


# ── Translation ──────────────────────────────────────────────────────────────


def translate_phrase(dutch_text: str, context: str = "") -> str:
    """Translate a Dutch phrase to English using Qwen."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    client = _get_client()
    system = (
        "You are a Dutch-to-English translator. "
        "Return ONLY the English translation, nothing else. "
        "If context is provided, use it for disambiguation."
    )
    user_msg = f"Translate this Dutch text to English: \"{dutch_text}\""
    if context:
        user_msg += f"\nContext: \"{context}\""

    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


# ── Custom scene generation ─────────────────────────────────────────────────

SCENE_LEVEL_CONFIGS = {
    "A1": {"vocab_count": 8, "sentence_count": 5, "short_q": 3, "long_q": 2, "desc": "basic vocabulary, simple present tense, short sentences"},
    "A2": {"vocab_count": 12, "sentence_count": 8, "short_q": 4, "long_q": 3, "desc": "everyday topics, past tense allowed, compound sentences"},
    "B1": {"vocab_count": 15, "sentence_count": 10, "short_q": 5, "long_q": 4, "desc": "opinions, comparisons, complex sentences, varied tenses"},
}


def generate_custom_scene(topic_en: str, level: str = "A2") -> dict:
    """Generate a full speaking scene (vocab + sentences + questions) for a topic."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    cfg = SCENE_LEVEL_CONFIGS.get(level, SCENE_LEVEL_CONFIGS["A2"])
    client = _get_client()

    prompt = f"""Generate a Dutch {level} speaking exam scene about: "{topic_en}".

Return ONLY valid JSON:
{{
  "title_en": "English title",
  "title_nl": "Dutch title",
  "vocab": [
    {{"dutch": "phrase", "english": "translation", "example": "example sentence"}},
    ...
  ],
  "model_sentences": [
    {{"text": "Dutch sentence", "english": "English translation"}},
    ...
  ],
  "exam_questions": {{
    "short": [
      {{"id": "q1", "prompt_nl": "Dutch question?", "prompt_en": "English?", "prep_seconds": 15, "record_seconds": 30, "expected_phrases": ["phrase1"], "model_answer": "Dutch model answer", "question_type": "short"}},
      ...
    ],
    "long": [
      {{"id": "q1l", "prompt_nl": "Dutch question?", "prompt_en": "English?", "prep_seconds": 30, "record_seconds": 60, "expected_phrases": ["phrase1"], "model_answer": "Dutch model answer", "question_type": "long"}},
      ...
    ]
  }}
}}

Requirements:
- {cfg['vocab_count']} vocab items with dutch, english, example
- {cfg['sentence_count']} model sentences using the vocab
- {cfg['short_q']} short questions (15s prep, 30s record) and {cfg['long_q']} long questions (30s prep, 60s record)
- {level} level: {cfg['desc']}
- All content in Dutch, translations in English
- Questions should test speaking ability about this topic"""

    last_err = None
    for _ in range(2):
        try:
            response = client.chat.completions.create(
                model=CONTENT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            raw = response.choices[0].message.content.strip()
            lines = raw.split("\n")
            if lines[0].startswith("```"):
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(raw)
            assert "title_en" in data and "title_nl" in data
            assert "vocab" in data and len(data["vocab"]) >= 3
            assert "model_sentences" in data and len(data["model_sentences"]) >= 2
            assert "exam_questions" in data
            return data
        except Exception as e:
            last_err = e
            time.sleep(1)

    raise RuntimeError(f"Scene generation failed: {last_err}")
