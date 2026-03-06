"""STT transcription + Qwen LLM speaking review + pattern analysis."""

import json
from pathlib import Path
from typing import Any

from backend.config import AI_API_KEY, AI_BASE_URL, AI_MODEL


def _get_client():
    from openai import OpenAI
    return OpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL)


def transcribe_audio(audio_path: Path) -> str:
    """Transcribe audio file using Qwen omni model via chat completions."""
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY / DASHSCOPE_API_KEY is not set")

    import base64

    client = _get_client()
    with open(audio_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode()

    ext = audio_path.suffix.lstrip(".") or "webm"
    data_uri = f"data:audio/{ext};base64,{audio_b64}"

    result = client.chat.completions.create(
        model="qwen-omni-turbo",
        messages=[{
            "role": "user",
            "content": [
                {"type": "input_audio", "input_audio": {"data": data_uri, "format": ext}},
                {"type": "text", "text": "Transcribe this Dutch audio exactly. Return ONLY the transcription text, nothing else."},
            ],
        }],
        temperature=0,
    )
    return (result.choices[0].message.content or "").strip()


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


def review_shadow(transcript: str, original_sentence: str) -> dict:
    """Compare a shadow-reading transcript to the original sentence. Returns similarity feedback."""
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY / DASHSCOPE_API_KEY is not set")

    client = _get_client()

    system_prompt = """You are a Dutch pronunciation coach. Compare a student's spoken transcript to the original Dutch sentence.

Return ONLY valid JSON:
{
  "similarity_score": <0-100>,
  "word_matches": ["words the student said correctly"],
  "word_misses": ["words the student missed or mispronounced"],
  "feedback": "1-2 sentences of feedback in English"
}"""

    user_msg = f"""Original sentence: {original_sentence}
Student's transcript: {transcript}

Compare and return only valid JSON."""

    response = client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "similarity_score": 0,
            "word_matches": [],
            "word_misses": original_sentence.split(),
            "feedback": "Could not parse AI feedback. Please try again.",
        }


def analyze_speaking_patterns(data: dict[str, Any]) -> dict:
    """Use LLM to identify speaking patterns and suggest focus areas from aggregated data."""
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY / DASHSCOPE_API_KEY is not set")

    client = _get_client()

    system_prompt = """You are a Dutch language speaking coach. Analyze the student's speaking practice data and provide insights.

Return ONLY valid JSON:
{
  "patterns": ["pattern1", "pattern2", ...],
  "focus_areas": ["area1", "area2"],
  "summary": "2-3 sentence progress summary in English",
  "suggested_scene_topic": "A topic suggestion for practice or null"
}

Rules:
- patterns: 2-4 observations about recurring mistakes (pronunciation, grammar, vocabulary)
- focus_areas: 2-3 specific areas to improve
- summary: encouraging but honest, mention concrete numbers if available
- suggested_scene_topic: a practical Dutch conversation topic, or null if not enough data"""

    user_msg = f"""Student's speaking analysis data:

Top missed words: {json.dumps(data.get('missed_words', [])[:10], ensure_ascii=False)}
Top shadow reading misses: {json.dumps(data.get('shadow_misses', [])[:8], ensure_ascii=False)}
Top grammar errors: {json.dumps(data.get('grammar_patterns', [])[:8], ensure_ascii=False)}
Weak areas: {json.dumps(data.get('weak_areas', {}), ensure_ascii=False)}
Week comparison: {json.dumps(data.get('comparison', {}), ensure_ascii=False)}
Total sessions: {data.get('total_sessions', 0)}
Mode stats: {json.dumps(data.get('mode_stats', {}), ensure_ascii=False)}

Analyze and return only valid JSON."""

    response = client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.5,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "patterns": [],
            "focus_areas": [],
            "summary": "Could not generate AI insights. Please try again later.",
            "suggested_scene_topic": None,
        }
