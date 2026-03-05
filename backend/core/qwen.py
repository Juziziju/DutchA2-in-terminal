"""Qwen LLM calls via DashScope — extracted from scripts/listening.py."""

import json
import random
import time

from backend.config import DASHSCOPE_API_KEY

SYSTEM_PROMPT = """You are a Dutch language teacher. Generate a Dutch A2-level listening exercise.
Return ONLY valid JSON with no markdown fences, no explanation, just the raw JSON object.

Schema:
{
  "topic": "string (topic in English)",
  "speakers": ["Name1", "Name2"],
  "dialogue": [
    {"speaker": "Name1", "text": "Dutch sentence", "english": "English translation"},
    ...
  ],
  "questions": [
    {
      "question": "Dutch question?",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "answer": "A"
    },
    ...
  ]
}

Requirements:
- 2 speakers, 8-12 dialogue lines total
- A2 level Dutch throughout
- Naturally incorporate the given vocabulary words
- Each dialogue line must include an "english" field with a natural English translation
- Exactly 4 multiple-choice questions (A/B/C/D) written in Dutch
- The answer field must be one of: A, B, C, D"""


def _get_client():
    from openai import OpenAI
    return OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


def _call_qwen(vocab_sample: list[str]) -> str:
    client = _get_client()
    user_msg = (
        f"Create a Dutch A2 listening dialogue that naturally uses these words: "
        f"{', '.join(vocab_sample)}. "
        f"Return only valid JSON."
    )
    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.8,
    )
    return response.choices[0].message.content.strip()


def _validate_dialogue(data: dict):
    required_top = {"topic", "speakers", "dialogue", "questions"}
    missing = required_top - set(data.keys())
    if missing:
        raise ValueError(f"Missing top-level keys: {missing}")
    if not isinstance(data["dialogue"], list) or len(data["dialogue"]) < 2:
        raise ValueError("dialogue must be a list with at least 2 entries")
    for i, line in enumerate(data["dialogue"]):
        if "speaker" not in line or "text" not in line or "english" not in line:
            raise ValueError(f"dialogue[{i}] missing speaker/text/english")
    if not isinstance(data["questions"], list) or len(data["questions"]) != 4:
        raise ValueError(
            f"questions must be a list of exactly 4 items, got {len(data.get('questions', []))}"
        )
    for i, q in enumerate(data["questions"]):
        for key in ("question", "options", "answer"):
            if key not in q:
                raise ValueError(f"questions[{i}] missing '{key}'")
        if set(q["options"].keys()) != {"A", "B", "C", "D"}:
            raise ValueError(f"questions[{i}] options must have keys A, B, C, D")
        if q["answer"] not in ("A", "B", "C", "D"):
            raise ValueError(f"questions[{i}] answer must be A/B/C/D")


def generate_dialogue(vocab_words: list[str]) -> tuple[dict, list[str]]:
    """Sample vocab, call Qwen, parse + validate JSON. Retries once on failure."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    sample = random.sample(vocab_words, min(12, len(vocab_words)))

    last_err = None
    for attempt in range(2):
        try:
            raw = _call_qwen(sample)
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(raw)
            _validate_dialogue(data)
            return data, sample
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)

    raise RuntimeError(f"Dialogue generation failed after 2 attempts: {last_err}")


def get_explanation(data: dict, questions: list[dict], user_answers: list[str]) -> str:
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
        f"The student just completed a Dutch A2 listening exercise.\n\n"
        f"Topic: {data['topic']}\n\n"
        f"Dialogue transcript:\n{transcript}\n\n"
        f"Questions and student answers:\n{qa_summary}"
        f"Please explain in English, for each question, why the correct answer is right "
        f"and (if the student was wrong) why their choice was incorrect. "
        f"Reference specific lines from the dialogue to support each explanation. "
        f"Keep it clear and encouraging for an A2 learner."
    )

    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )
    return response.choices[0].message.content.strip()
