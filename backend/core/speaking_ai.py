"""STT transcription + Qwen LLM speaking review + pattern analysis."""

import json
from pathlib import Path
from typing import Any

from backend.config import AI_API_KEY, AI_BASE_URL, AI_MODEL


def _get_client():
    from openai import OpenAI
    return OpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL)


def transcribe_audio(audio_path: Path) -> str:
    """Transcribe audio file using Groq Whisper API."""
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not set")

    client = _get_client()
    with open(audio_path, "rb") as f:
        result = client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=f,
            language="nl",
        )
    return (result.text or "").strip()


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
        raise RuntimeError("AI_API_KEY is not set")

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
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()

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
        raise RuntimeError("AI_API_KEY is not set")

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
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "similarity_score": 0,
            "word_matches": [],
            "word_misses": original_sentence.split(),
            "feedback": "Could not parse AI feedback. Please try again.",
        }


def generate_spreken_prompt(prompt_type: str) -> dict:
    """Generate an AI speaking prompt for MockExam Spreken.

    prompt_type: "afbeelding" (scene description + personal question) or "persoonlijk" (daily life question).
    Returns SprekenVraag-format dict.
    """
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not set")

    client = _get_client()

    if prompt_type == "afbeelding":
        system_prompt = """You generate Dutch A2 speaking exam questions. Create ONE question that:
1. Describes a scene/photo in Dutch (situatie_nl) — e.g. "Er is een foto van een man in een café die koffie drinkt"
2. Asks the student to describe what they see AND answer a personal follow-up question
3. Keep everything at A2 level — simple vocabulary, everyday situations

Return ONLY valid JSON:
{
  "id": "ai_afb_<random4digits>",
  "situatie_nl": "Scene description in Dutch",
  "situatie_en": "Scene description in English",
  "vraag_nl": "Vertel wat u ziet. [+ personal follow-up in Dutch]",
  "vraag_en": "Describe what you see. [+ personal follow-up in English]",
  "prep_seconds": 30,
  "record_seconds": 60,
  "model_answer": "A model A2-level answer in Dutch (5-8 sentences)",
  "tips": ["tip1", "tip2", "tip3", "tip4"],
  "expected_phrases": ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5"],
  "question_type": "long"
}

Topics to choose from: market/shopping, cooking/food, park/nature, work/office, school, transport, sports, neighbourhood, hospital/doctor, birthday/celebration. Pick one randomly."""
    else:
        system_prompt = """You generate Dutch A2 speaking exam questions about daily life. Create ONE personal question that:
1. Asks about the student's life — hobby, work, routine, neighbourhood, family, food, transport, etc.
2. Requires a 4-6 sentence answer at A2 level
3. The situatie_nl sets a brief context (1 sentence)

Return ONLY valid JSON:
{
  "id": "ai_pers_<random4digits>",
  "situatie_nl": "Brief context in Dutch",
  "situatie_en": "Brief context in English",
  "vraag_nl": "Question in Dutch",
  "vraag_en": "Question in English",
  "prep_seconds": 30,
  "record_seconds": 60,
  "model_answer": "A model A2-level answer in Dutch (4-6 sentences)",
  "tips": ["tip1", "tip2", "tip3"],
  "expected_phrases": ["phrase1", "phrase2", "phrase3", "phrase4"],
  "question_type": "long"
}

Topics: hobby, work/job, daily routine, neighbourhood, family, food/cooking, transport, weekend plans, learning Dutch, shopping habits. Pick one randomly."""

    response = client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate a {prompt_type} speaking question. Return only valid JSON."},
        ],
        temperature=0.9,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "id": f"ai_{prompt_type[:4]}_fallback",
            "situatie_nl": "U bent op een feestje.",
            "situatie_en": "You are at a party.",
            "vraag_nl": "Stel uzelf voor. Wat doet u graag in uw vrije tijd?",
            "vraag_en": "Introduce yourself. What do you like to do in your free time?",
            "prep_seconds": 30,
            "record_seconds": 60,
            "model_answer": "Hallo, ik heet ... Ik kom uit ... In mijn vrije tijd lees ik graag en ik wandel ook veel.",
            "tips": ["Introduce yourself", "Talk about hobbies", "Keep it simple"],
            "expected_phrases": ["ik heet", "ik kom uit", "in mijn vrije tijd", "ik vind"],
            "question_type": "long",
        }


def review_speaking_mockexam(
    transcript: str,
    prompt_nl: str,
    prompt_en: str,
    expected_phrases: list[str],
    model_answer: str,
) -> dict:
    """Strict A2 speaking grader for MockExam. Returns X/5 scores + bilingual feedback."""
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not set")

    client = _get_client()

    system_prompt = """You are a STRICT A2 Dutch speaking exam grader (inburgeringsexamen level).

Score on TWO criteria (each 0-5):
1. content_score (weight 50%): Did the student answer ALL parts of the question?
   - 5: All parts answered clearly
   - 4: Most parts answered
   - 3: Some parts answered
   - 2: Barely addressed the question
   - 1: Off-topic but in Dutch
   - 0: No relevant content

2. grammar_score (weight 50%): A2-level grammar correctness
   - Only count A2 errors: verb conjugation (ik werk/hij werkt), V2 word order, de/het, niet/geen, plural forms
   - Do NOT penalize: simple sentence structures, informal vocabulary, punctuation, B1+ expressions
   - ORAL EXEMPTIONS (do NOT penalize): hesitation words (nou, eh, even, uhm), incomplete sentences (normal in speech), STT spelling artifacts, dropped articles in fast speech

Return ONLY valid JSON:
{
  "score": <0-100 overall, = (content_score + grammar_score) / 10 * 100>,
  "content_score": <0-5>,
  "grammar_score": <0-5>,
  "grammar_errors": [
    {
      "wrong": "what the student said",
      "correct": "corrected version",
      "explanation_nl": "Korte uitleg in het Nederlands",
      "explanation_zh": "中文解释"
    }
  ],
  "feedback_nl": "2-3 zinnen feedback in het Nederlands, bemoedigend maar eerlijk",
  "improved_answer": "Corrected version of the student's answer in Dutch"
}

Rules:
- Maximum 4 grammar_errors
- feedback_nl must be in Dutch
- grammar_errors explanations: explanation_nl in Dutch, explanation_zh in Chinese
- If transcript is "(no speech detected)" → score 0, feedback says "Geen spraak gedetecteerd"
- Be encouraging but honest"""

    user_msg = f"""Exam prompt (NL): {prompt_nl}
Exam prompt (EN): {prompt_en}
Expected phrases: {', '.join(expected_phrases)}
Model answer: {model_answer}

Student's transcript:
{transcript}

Grade this spoken response. Return only valid JSON."""

    response = client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "score": 0,
            "content_score": 0,
            "grammar_score": 0,
            "grammar_errors": [],
            "feedback_nl": "Kon AI-feedback niet verwerken. Probeer het opnieuw.",
            "improved_answer": model_answer,
        }


def analyze_speaking_patterns(data: dict[str, Any]) -> dict:
    """Use LLM to identify speaking patterns and suggest focus areas from aggregated data."""
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not set")

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
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "patterns": [],
            "focus_areas": [],
            "summary": "Could not generate AI insights. Please try again later.",
            "suggested_scene_topic": None,
        }
