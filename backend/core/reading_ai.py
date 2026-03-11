"""AI generation for reading passages and comprehension questions."""

import json
import time

from backend.config import DASHSCOPE_API_KEY
from backend.core.qwen import CONTENT_MODEL

READING_TYPE_CONFIGS = {
    "short_text": {"sentences": "3-5", "questions": 2, "desc": "short notice, sign, or label"},
    "email": {"sentences": "6-10", "questions": 3, "desc": "formal or informal email/letter"},
    "advertisement": {"sentences": "4-8", "questions": 3, "desc": "job/housing/product advertisement"},
    "notice": {"sentences": "5-8", "questions": 3, "desc": "official notice from gemeente/school/employer"},
    "article": {"sentences": "8-14", "questions": 4, "desc": "short newspaper or magazine article"},
}


def _get_client():
    from openai import OpenAI
    return OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


def _build_reading_prompt(content_type: str, level: str, topic: str = "") -> tuple[str, str]:
    cfg = READING_TYPE_CONFIGS.get(content_type, READING_TYPE_CONFIGS["short_text"])
    topic_line = f"\n- The passage MUST be about: {topic}" if topic else ""
    system = f"""You are a Dutch language teacher creating {level}-level reading exercises for the Inburgering exam.
Return ONLY valid JSON with no markdown fences, no explanation, just the raw JSON object.

Schema:
{{
  "content_type": "{content_type}",
  "topic": "English topic description",
  "title_nl": "Dutch title",
  "passage_nl": "Full Dutch passage text...",
  "passage_en": "Full English translation of passage...",
  "questions": [
    {{
      "id": "q1",
      "question_nl": "Dutch question?",
      "question_en": "English translation of question?",
      "options": {{"A": "option text", "B": "option text", "C": "option text", "D": "option text"}},
      "answer": "B",
      "explanation_en": "Quote the relevant Dutch sentence, give its English translation, then explain why B is correct. Format: '\"Dutch quote\" — \"English translation\". Reason...'"
    }}
  ]
}}

Requirements:
- Write a {cfg['desc']} in Dutch at {level} level
- {cfg['sentences']} sentences in the passage
- Exactly {cfg['questions']} multiple-choice questions (A/B/C/D)
- Questions should test: main idea comprehension, detail extraction, inference, vocabulary in context
- All question options must be plausible
- Include English translations for both passage and questions
- Each explanation_en MUST: quote the relevant Dutch sentence from the passage, provide its English translation, then explain why the answer is correct{topic_line}"""

    topic_part = f" about: {topic}." if topic else "."
    user_msg = f"Create a Dutch {level} reading exercise ({content_type}){topic_part} Return only valid JSON."
    return system, user_msg


def _validate_reading(data: dict, content_type: str):
    cfg = READING_TYPE_CONFIGS.get(content_type, READING_TYPE_CONFIGS["short_text"])
    required = {"content_type", "topic", "title_nl", "passage_nl", "passage_en", "questions"}
    missing = required - set(data.keys())
    if missing:
        raise ValueError(f"Missing keys: {missing}")
    if not isinstance(data["questions"], list) or len(data["questions"]) != cfg["questions"]:
        raise ValueError(f"Expected {cfg['questions']} questions, got {len(data.get('questions', []))}")
    for i, q in enumerate(data["questions"]):
        for key in ("id", "question_nl", "question_en", "options", "answer", "explanation_en"):
            if key not in q:
                raise ValueError(f"questions[{i}] missing '{key}'")
        if set(q["options"].keys()) != {"A", "B", "C", "D"}:
            raise ValueError(f"questions[{i}] options must have keys A, B, C, D")
        if q["answer"] not in ("A", "B", "C", "D"):
            raise ValueError(f"questions[{i}] answer must be A/B/C/D")


def generate_reading(content_type: str = "short_text", level: str = "A2", topic: str = "") -> dict:
    """Generate a reading passage with comprehension questions. Retries once on failure."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    system, user_msg = _build_reading_prompt(content_type, level, topic)
    client = _get_client()

    last_err = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=CONTENT_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.8,
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(raw)
            _validate_reading(data, content_type)
            return data
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)

    raise RuntimeError(f"Reading generation failed after 2 attempts: {last_err}")
