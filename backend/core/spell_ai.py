"""AI generation and grading for spell practice (translation) exercises."""

import json
import time

from backend.config import AI_API_KEY
from backend.core.qwen import FAST_MODEL
from backend.core.spell_scenes import SPELL_SCENES
from backend.core.writing_ai import _get_client, _strip_fences, _normalize, _correction_matches


def _get_scene(scene_id: str) -> dict | None:
    for s in SPELL_SCENES:
        if s["id"] == scene_id:
            return s
    return None


def generate_spell_exercise(scene_id: str, level: str = "A2") -> dict:
    """Generate 8 English→Dutch translation sentences for a scene at given level.

    Also generates a vocabulary list of key words used in the sentences.
    """
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not set")

    scene = _get_scene(scene_id)
    if not scene:
        raise ValueError(f"Unknown scene: {scene_id}")

    system = f"""You are a Dutch language teacher creating translation exercises at {level} level.
Generate exactly 8 sentences for the scene: "{scene['title_en']}" ({scene['description']}).

Each sentence should be a natural, everyday sentence that someone would say or write in this situation.
Use {level}-appropriate vocabulary and grammar.

Also generate a vocabulary list of 10-15 key Dutch words/phrases used in the sentences,
with their English translations. Focus on content words (nouns, verbs, adjectives) that
students might not know.

Return ONLY valid JSON with no markdown fences:
{{
  "sentences": [
    {{
      "text_en": "I would like two kilos of apples.",
      "text_nl": "Ik wil graag twee kilo appels."
    }}
  ],
  "vocabulary": [
    {{"nl": "appels", "en": "apples"}},
    {{"nl": "kilo", "en": "kilo"}}
  ]
}}

Requirements:
- Exactly 8 sentences
- Each sentence 5-15 words
- Natural, realistic sentences for this scene
- {level} level vocabulary and grammar
- Vary sentence structures (questions, statements, requests)
- Include common Dutch constructions (separable verbs, modal verbs, etc.)
- Vocabulary list: 10-15 key content words from the sentences"""

    client = _get_client()
    last_err = None

    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=FAST_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": f"Create 8 translation sentences for: {scene['title_en']}. Return only valid JSON."},
                ],
                temperature=0.9,
                response_format={"type": "json_object"},
            )
            raw = _strip_fences(response.choices[0].message.content.strip())
            data = json.loads(raw)

            sentences = data.get("sentences", [])
            if len(sentences) < 4:
                raise ValueError("Too few sentences generated")

            for s in sentences:
                s["hint_parts"] = _build_hint_parts(s["text_nl"])

            vocabulary = data.get("vocabulary", [])

            return {
                "task_type": "spell_practice",
                "scene_id": scene_id,
                "scene_title_nl": scene["title_nl"],
                "scene_title_en": scene["title_en"],
                "level": level,
                "sentences": sentences,
                "vocabulary": vocabulary,
            }
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)

    raise RuntimeError(f"Spell exercise generation failed after 2 attempts: {last_err}")


def _build_hint_parts(text_nl: str) -> list[str | None]:
    """Build hint_parts: reveal ~40-50% of words (function words), hide the rest."""
    FUNCTION_WORDS = {
        "de", "het", "een",
        "in", "op", "aan", "met", "van", "voor", "naar", "uit", "bij", "tot",
        "om", "over", "door", "onder", "tussen", "zonder", "tegen", "langs",
        "ik", "jij", "je", "hij", "zij", "ze", "het", "wij", "we", "jullie", "u",
        "mij", "me", "hem", "haar", "ons",
        "en", "of", "maar", "want", "dat", "als", "omdat", "toen", "dan",
        "dus", "ook", "nog", "wel", "niet", "geen",
        "is", "ben", "bent", "zijn", "was", "waren", "er", "hier", "daar",
        "heel", "erg", "te", "al", "zo",
    }

    words = text_nl.split()
    parts: list[str | None] = []
    revealed = 0

    for w in words:
        core = w.rstrip(".,;:!?\"'()").lower()
        if core in FUNCTION_WORDS:
            parts.append(w)
            revealed += 1
        else:
            parts.append(None)

    target_min = len(words) * 0.35
    if revealed < target_min:
        for i, w in enumerate(words):
            if parts[i] is None and len(w.rstrip(".,;:!?")) <= 3:
                parts[i] = w
                revealed += 1
                if revealed >= target_min:
                    break

    target_max = len(words) * 0.55
    if revealed > target_max:
        for i in range(len(parts) - 1, -1, -1):
            if parts[i] is not None:
                core = words[i].rstrip(".,;:!?\"'()").lower()
                if core not in {"de", "het", "een", "ik", "jij", "je", "hij", "zij", "ze", "wij", "we", "u"}:
                    parts[i] = None
                    revealed -= 1
                    if revealed <= target_max:
                        break

    return parts


def grade_spell_exercise(prompt: dict, user_answers: list[dict]) -> dict:
    """Grade spell practice — purely deterministic, no AI calls.

    Compares user answers against the pre-generated correct Dutch translations.
    """
    sentences = prompt.get("sentences", [])
    answer_map: dict[int, str] = {}
    for a in user_answers:
        answer_map[a.get("sentence_index", -1)] = a.get("user_text", "")

    results = []
    correct_count = 0

    for i, s in enumerate(sentences):
        user_text = answer_map.get(i, "").strip()
        expected = s.get("text_nl", "")
        english = s.get("text_en", "")

        correct = False
        if not user_text:
            pass
        elif _correction_matches(user_text, expected):
            correct = True
            correct_count += 1

        results.append({
            "sentence_index": i,
            "text_en": english,
            "text_nl": expected,
            "user_text": user_text,
            "correct": correct,
            "feedback": None,
            "ai_reviewed": False,
        })

    total = len(sentences)
    score = round((correct_count / max(total, 1)) * 100)
    feedback_en, feedback_nl = _generate_spell_feedback(correct_count, total, score)

    return {
        "score": score,
        "correct_count": correct_count,
        "total_sentences": total,
        "results": results,
        "feedback_en": feedback_en,
        "feedback_nl": feedback_nl,
    }


def review_spell_sentence(english: str, expected_nl: str, user_text: str) -> dict:
    """AI review a single sentence — called on demand when user clicks 'AI Review'.

    Returns { correct: bool, feedback: str }
    """
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not set")

    client = _get_client()
    try:
        response = client.chat.completions.create(
            model=FAST_MODEL,
            messages=[
                {"role": "system", "content": (
                    "You are a Dutch language teacher reviewing a student's translation.\n"
                    "The student translated an English sentence to Dutch. "
                    "Their answer differs from the expected answer but may still be correct "
                    "(different word order, synonyms, valid alternative phrasing).\n\n"
                    "Judge if the student's Dutch is a correct and natural translation of the English.\n"
                    "Reply ONLY with valid JSON:\n"
                    "{\"correct\": true/false, \"feedback\": \"...\"}\n\n"
                    "- If correct: feedback should acknowledge the valid alternative briefly.\n"
                    "- If incorrect: feedback should explain what's wrong and show the correction (1-2 sentences, in English)."
                )},
                {"role": "user", "content": (
                    f"English: \"{english}\"\n"
                    f"Expected Dutch: \"{expected_nl}\"\n"
                    f"Student wrote: \"{user_text}\"\n\n"
                    f"Is the student's translation correct?"
                )},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        raw = _strip_fences(response.choices[0].message.content.strip())
        data = json.loads(raw)
        return {
            "correct": bool(data.get("correct", False)),
            "feedback": data.get("feedback", ""),
        }
    except Exception as e:
        return {"correct": False, "feedback": f"AI review failed: {e}"}


def _generate_spell_feedback(correct: int, total: int, score: int) -> tuple[str, str]:
    """Generate short feedback strings without AI."""
    if score >= 80:
        en = f"Great job! You correctly translated {correct} out of {total} sentences."
        nl = f"Heel goed! Je hebt {correct} van de {total} zinnen goed vertaald."
    elif score >= 60:
        en = f"Good effort! You got {correct} out of {total} correct. Keep practicing the ones you missed."
        nl = f"Goed geprobeerd! {correct} van de {total} zinnen waren goed. Blijf oefenen!"
    else:
        en = f"You got {correct} out of {total} correct. Review the corrections and try again!"
        nl = f"Je hebt {correct} van de {total} zinnen goed. Bekijk de verbeteringen en probeer opnieuw!"

    return en, nl
