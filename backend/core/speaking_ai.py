"""STT transcription + Qwen LLM speaking review."""

import json
from pathlib import Path

from backend.config import AI_API_KEY, AI_BASE_URL, AI_MODEL


def _get_client():
    from openai import OpenAI
    return OpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL)


def transcribe_audio(audio_path: Path) -> str:
    """Transcribe audio file using DashScope Paraformer (OpenAI-compatible API)."""
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY / DASHSCOPE_API_KEY is not set")

    client = _get_client()
    with open(audio_path, "rb") as f:
        result = client.audio.transcriptions.create(
            model="paraformer-v2",
            file=f,
            language="nl",
        )
    return result.text.strip()


def review_speaking(
    transcript: str,
    prompt_nl: str,
    prompt_en: str,
    expected_phrases: list[str],
    model_answer: str,
    question_type: str,
) -> dict:
    """Use Qwen to evaluate a speaking transcript. Returns structured feedback."""
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY / DASHSCOPE_API_KEY is not set")

    client = _get_client()

    system_prompt = """You are an A2 Dutch speaking exam grader. You will receive:
- The exam prompt (Dutch + English)
- The student's speech transcript (from STT)
- Expected phrases the student should use
- A model answer for reference
- Question type (short = 30s, long = 60s)

Score the transcript on THREE criteria (each 0-100):
1. vocabulary_score: Did the student use relevant Dutch words and expected phrases?
2. grammar_score: Is word order, verb conjugation, articles correct for A2 level?
3. completeness_score: Did the response actually answer the question fully?

Return ONLY valid JSON:
{
  "score": <overall 0-100>,
  "vocabulary_score": <0-100>,
  "grammar_score": <0-100>,
  "completeness_score": <0-100>,
  "matched_phrases": ["phrases the student used correctly"],
  "missing_phrases": ["expected phrases the student missed"],
  "grammar_errors": [{"error": "what was wrong", "correction": "how to fix it"}],
  "feedback_en": "2-3 sentences of encouraging feedback in English",
  "improved_answer": "A corrected version of the student's answer in Dutch"
}"""

    user_msg = f"""Exam prompt (NL): {prompt_nl}
Exam prompt (EN): {prompt_en}
Question type: {question_type}
Expected phrases: {', '.join(expected_phrases)}
Model answer: {model_answer}

Student's transcript:
{transcript}

Grade this response. Return only valid JSON."""

    response = client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
    )

    raw = response.choices[0].message.content.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "score": 0,
            "vocabulary_score": 0,
            "grammar_score": 0,
            "completeness_score": 0,
            "matched_phrases": [],
            "missing_phrases": expected_phrases,
            "grammar_errors": [],
            "feedback_en": "Could not parse AI feedback. Please try again.",
            "improved_answer": model_answer,
        }
