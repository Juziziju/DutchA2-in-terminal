"""Qwen LLM calls via DashScope — extracted from scripts/listening.py."""

import json
import random
import time

from backend.config import DASHSCOPE_API_KEY

LEVEL_CONFIGS = {
    "A1": {
        "dialogue_lines": "6-8",
        "questions": 3,
        "vocab_sample": 8,
        "description": "Simple present tense, basic vocabulary, short sentences. Topics: greetings, family, shopping, weather.",
    },
    "A2": {
        "dialogue_lines": "8-12",
        "questions": 4,
        "vocab_sample": 12,
        "description": "Present and past tense, everyday topics like appointments, travel, daily routines.",
    },
    "B1": {
        "dialogue_lines": "10-14",
        "questions": 5,
        "vocab_sample": 15,
        "description": "Varied tenses (present, past, future, conditional), complex sentence structures, abstract topics like opinions, plans, news.",
    },
}


def _build_system_prompt(level: str = "A2") -> str:
    cfg = LEVEL_CONFIGS.get(level, LEVEL_CONFIGS["A2"])
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
- Naturally incorporate the given vocabulary words
- Each dialogue line must include an "english" field with a natural English translation
- Exactly {cfg['questions']} multiple-choice questions (A/B/C/D) written in Dutch
- The answer field must be one of: A, B, C, D"""


def _get_client():
    from openai import OpenAI
    return OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


def _call_qwen(vocab_sample: list[str], level: str = "A2") -> str:
    client = _get_client()
    user_msg = (
        f"Create a Dutch {level} listening dialogue that naturally uses these words: "
        f"{', '.join(vocab_sample)}. "
        f"Return only valid JSON."
    )
    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": _build_system_prompt(level)},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.8,
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


def generate_dialogue(vocab_words: list[str], level: str = "A2") -> tuple[dict, list[str]]:
    """Sample vocab, call Qwen, parse + validate JSON. Retries once on failure."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    cfg = LEVEL_CONFIGS.get(level, LEVEL_CONFIGS["A2"])
    sample_size = min(cfg["vocab_sample"], len(vocab_words))
    sample = random.sample(vocab_words, sample_size)

    last_err = None
    for attempt in range(2):
        try:
            raw = _call_qwen(sample, level)
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(raw)
            _validate_dialogue(data, level)
            return data, sample
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


def _build_intensive_prompt(level: str = "A2", content_type: str = "dialogue") -> str:
    lvl_cfg = LEVEL_CONFIGS.get(level, LEVEL_CONFIGS["A2"])
    type_cfg = INTENSIVE_TYPE_CONFIGS.get(content_type, INTENSIVE_TYPE_CONFIGS["dialogue"])
    line_range = type_cfg["lines"].get(level, type_cfg["lines"]["A2"])
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
- Naturally incorporate the given vocabulary words
- Each line must include an "english" field with a natural English translation
- Each sentence should be a natural, complete thought (not too long, suitable for dictation)"""


def _call_qwen_intensive(vocab_sample: list[str], level: str = "A2", content_type: str = "dialogue") -> str:
    client = _get_client()
    user_msg = (
        f"Create a Dutch {level} {content_type} for dictation that naturally uses these words: "
        f"{', '.join(vocab_sample)}. "
        f"Return only valid JSON."
    )
    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": _build_intensive_prompt(level, content_type)},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.8,
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


def generate_intensive(vocab_words: list[str], level: str = "A2", content_type: str = "dialogue") -> tuple[dict, list[str]]:
    """Generate intensive listening content. Retries once on failure."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    cfg = LEVEL_CONFIGS.get(level, LEVEL_CONFIGS["A2"])
    sample_size = min(cfg["vocab_sample"], len(vocab_words))
    sample = random.sample(vocab_words, sample_size)

    last_err = None
    for attempt in range(2):
        try:
            raw = _call_qwen_intensive(sample, level, content_type)
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(raw)
            _validate_intensive(data)
            return data, sample
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

    transcript = "\n".join(
        f"{line['speaker']}: {line['text']} ({line.get('english', '')})"
        for line in data["dialogue"]
    )

    qa_summary = ""
    for i, (q, ua) in enumerate(zip(questions, user_answers), 1):
        correct = q["answer"]
        correct_text = q["options"][correct]
        user_text = q["options"][ua]
        status = "correct" if ua == correct else "incorrect"
        qa_summary += (
            f"Q{i}: {q['question']}\n"
            f"  User answered {ua}) {user_text} — {status}\n"
            f"  Correct answer: {correct}) {correct_text}\n\n"
        )

    prompt = (
        f"The student just completed a Dutch {level} listening exercise.\n\n"
        f"Topic: {data['topic']}\n\n"
        f"Dialogue transcript:\n{transcript}\n\n"
        f"Questions and student answers:\n{qa_summary}"
        f"Please explain in English, for each question, why the correct answer is right "
        f"and (if the student was wrong) why their choice was incorrect. "
        f"Reference specific lines from the dialogue to support each explanation. "
        f"Keep it clear and encouraging for a {level} learner."
    )

    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )
    return response.choices[0].message.content.strip()
