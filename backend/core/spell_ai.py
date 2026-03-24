"""AI generation and grading for translation practice exercises."""

import json
import time

from backend.config import AI_API_KEY
from backend.core.qwen import CONTENT_MODEL, FAST_MODEL
from backend.core.spell_scenes import SPELL_SCENES
from backend.core.writing_ai import _get_client, _strip_fences


def _get_scene(scene_id: str) -> dict | None:
    for s in SPELL_SCENES:
        if s["id"] == scene_id:
            return s
    return None


def generate_spell_exercise(scene_id: str, level: str = "A2") -> dict:
    """Generate 6 English→Dutch translation sentences for a scene at given level.

    Each sentence includes word hints and grammar focus.
    """
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not set")

    scene = _get_scene(scene_id)
    if not scene:
        raise ValueError(f"Unknown scene: {scene_id}")

    system = f"""You are a Dutch language teacher creating translation exercises strictly at {level} level.
Generate exactly 6 sentences for the scene: "{scene['title_en']}" ({scene['description']}).

STRICT RULES:
- ALL vocabulary must be {level} level or below. NO B1+ words.
- FORBIDDEN words: contract, factuur, bestelling, terugkoppeling, bevestigen, vergadering, afdeling, beoordeling, sollicitatie, deadline, budget, collega's (use "mensen op het werk" if needed)
- FORBIDDEN topics: business meetings, contracts, invoices, job interviews, corporate email
- ALLOWED scenes: daily shopping, doctor/pharmacy, public transport, simple emails to friends/family/neighbours, daily routines, restaurant/cafe, city hall (simple requests)
- Each sentence: maximum 10 words
- Use simple, everyday language a beginner would know
- Vary sentence types: questions, statements, polite requests (with "graag", "alstublieft")
- Include common A2 constructions: modal verbs (willen, kunnen, moeten), separable verbs, basic word order

For each sentence, provide:
- text_en: English sentence
- text_nl: Dutch translation
- hints: exactly 3 word-level hints, each formatted as "dutch_word = English meaning" (pick the 3 most useful content words)
- grammar_focus: the main grammar point tested (e.g. "willen + infinitief", "V2 woordvolgorde", "scheidbaar werkwoord")
- scene: short scene label (e.g. "dokter", "supermarkt", "station")
- difficulty: "easy" or "medium"

Also provide a vocabulary list of 8-12 key Dutch words used in the sentences.

Return ONLY valid JSON:
{{
  "sentences": [
    {{
      "text_en": "I would like to make an appointment.",
      "text_nl": "Ik wil graag een afspraak maken.",
      "hints": ["afspraak = appointment", "maken = to make", "graag = gladly/please"],
      "grammar_focus": "willen + infinitief",
      "scene": "dokter",
      "difficulty": "easy"
    }}
  ],
  "vocabulary": [
    {{"nl": "afspraak", "en": "appointment"}},
    {{"nl": "maken", "en": "to make"}}
  ]
}}"""

    client = _get_client()
    last_err = None

    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=CONTENT_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": f"Create 6 translation sentences for: {scene['title_en']}. Strictly A2 level. Return only valid JSON."},
                ],
                temperature=0.9,
                response_format={"type": "json_object"},
            )
            raw = _strip_fences(response.choices[0].message.content.strip())
            data = json.loads(raw)

            sentences = data.get("sentences", [])
            if len(sentences) < 4:
                raise ValueError("Too few sentences generated")

            # Ensure each sentence has the new fields with defaults
            for s in sentences:
                if "hints" not in s:
                    s["hints"] = []
                if "grammar_focus" not in s:
                    s["grammar_focus"] = ""
                if "scene" not in s:
                    s["scene"] = scene_id
                if "difficulty" not in s:
                    s["difficulty"] = "medium"

            # Validate: check that Dutch translations actually match the English
            sentences = _validate_translations(client, sentences)

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


def _validate_translations(client, sentences: list[dict]) -> list[dict]:
    """Validate that each Dutch sentence correctly translates the English.

    Sends one batch request. Drops any sentence where subject/object/meaning
    is wrong and returns the rest (at least keep what's valid).
    """
    if not sentences:
        return sentences

    checks = []
    for i, s in enumerate(sentences):
        checks.append(f'{i+1}. EN: "{s["text_en"]}" → NL: "{s["text_nl"]}"')
    pairs_text = "\n".join(checks)

    try:
        response = client.chat.completions.create(
            model=CONTENT_MODEL,
            messages=[
                {"role": "system", "content": (
                    "You are a Dutch language expert. For each English→Dutch pair below, "
                    "check if the Dutch sentence is a correct translation of the English.\n"
                    "Check carefully: subject, object, verb meaning, pronouns must all match.\n"
                    "Example of a BAD pair: EN \"Can I help you?\" → NL \"Kunnen jullie me helpen?\" "
                    "(subject/object are swapped).\n\n"
                    "Return ONLY valid JSON: {\"results\": [{\"index\": 1, \"ok\": true/false, "
                    "\"fixed_nl\": \"...\"}]}\n"
                    "- If ok=true, fixed_nl can be empty string.\n"
                    "- If ok=false, provide the corrected Dutch in fixed_nl."
                )},
                {"role": "user", "content": pairs_text},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        raw = _strip_fences(response.choices[0].message.content.strip())
        data = json.loads(raw)

        validation = {r["index"]: r for r in data.get("results", [])}

        for i, s in enumerate(sentences):
            v = validation.get(i + 1)
            if v and not v.get("ok", True) and v.get("fixed_nl"):
                s["text_nl"] = v["fixed_nl"]

        return sentences
    except Exception:
        # Validation failed — return sentences as-is rather than blocking
        return sentences


def review_translation(
    english: str,
    expected_nl: str,
    user_text: str,
    hints_used: int = 0,
) -> dict:
    """AI review a single translation sentence.

    Returns structured feedback with score, errors, and Chinese explanations.
    """
    if not AI_API_KEY:
        raise RuntimeError("AI_API_KEY is not set")

    hints_penalty = 0
    if hints_used == 1:
        hints_penalty = 10
    elif hints_used >= 2:
        hints_penalty = 20

    client = _get_client()
    try:
        response = client.chat.completions.create(
            model=CONTENT_MODEL,
            messages=[
                {"role": "system", "content": (
                    "You are a Dutch A2 language teacher reviewing a student's English→Dutch translation.\n"
                    "The student is a Chinese speaker learning Dutch at A2 level.\n\n"
                    "GRADING RULES (strict A2 standard):\n"
                    "ACCEPT as correct (do NOT flag):\n"
                    "- Minor spelling errors (1-2 letters off)\n"
                    "- jij/u substitution (both are fine)\n"
                    "- Missing capitalisation\n"
                    "- Informal alternatives that are natural Dutch (e.g. 'hoi' for 'hallo')\n"
                    "- Valid alternative translations with different word choice\n"
                    "- Missing final punctuation\n"
                    "- Simple sentence structures (no need for complex ones at A2)\n\n"
                    "FLAG as errors:\n"
                    "- Wrong verb conjugation (ik heb vs ik heeft)\n"
                    "- V2 word order violation\n"
                    "- de/het error\n"
                    "- niet/geen confusion\n"
                    "- Missing required preposition (e.g. naar)\n"
                    "- Separable verb not separated when it should be\n"
                    "- Completely wrong word that changes meaning\n\n"
                    "SCORING:\n"
                    "- Start at 100\n"
                    "- Each error: -15 to -25 depending on severity\n"
                    "- Valid alternative translation with no errors: 100\n"
                    "- Empty or completely wrong: 0\n\n"
                    "Reply ONLY with valid JSON:\n"
                    "{\n"
                    "  \"correct\": true/false,\n"
                    "  \"score\": 0-100,\n"
                    "  \"errors\": [{\"wrong\": \"...\", \"correct\": \"...\", \"rule_nl\": \"...\", \"explanation_zh\": \"...\"}],\n"
                    "  \"alternative_accepted\": true/false,\n"
                    "  \"feedback_nl\": \"Korte feedback in het Nederlands\"\n"
                    "}\n\n"
                    "For errors array:\n"
                    "- wrong: the incorrect part from student's answer\n"
                    "- correct: what it should be\n"
                    "- rule_nl: the Dutch grammar rule name (e.g. 'V2 woordvolgorde', 'de/het', 'werkwoordvervoeging')\n"
                    "- explanation_zh: explanation in Chinese (简体中文) for the student\n\n"
                    "If the answer is correct (including valid alternatives), return empty errors array and correct=true."
                )},
                {"role": "user", "content": (
                    f"English: \"{english}\"\n"
                    f"Expected Dutch: \"{expected_nl}\"\n"
                    f"Student wrote: \"{user_text}\"\n\n"
                    f"Grade this translation."
                )},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        raw = _strip_fences(response.choices[0].message.content.strip())
        data = json.loads(raw)

        score = max(0, min(100, data.get("score", 0)))
        # Apply hints penalty
        score = max(0, score - hints_penalty)

        return {
            "correct": bool(data.get("correct", False)),
            "score": score,
            "errors": data.get("errors", []),
            "alternative_accepted": bool(data.get("alternative_accepted", False)),
            "feedback_nl": data.get("feedback_nl", ""),
            "hints_penalty": hints_penalty,
        }
    except Exception as e:
        return {
            "correct": False,
            "score": 0,
            "errors": [],
            "alternative_accepted": False,
            "feedback_nl": f"AI review failed: {e}",
            "hints_penalty": hints_penalty,
        }


def grade_spell_exercise(prompt: dict, user_answers: list[dict], hints_used: list[int] | None = None) -> dict:
    """Grade spell practice using AI review for each sentence.

    Args:
        prompt: the exercise prompt with sentences
        user_answers: list of {sentence_index, user_text}
        hints_used: list of hint counts per sentence (0, 1, 2, ...)
    """
    sentences = prompt.get("sentences", [])
    answer_map: dict[int, str] = {}
    for a in user_answers:
        answer_map[a.get("sentence_index", -1)] = a.get("user_text", "")

    if hints_used is None:
        hints_used = [0] * len(sentences)

    results = []
    correct_count = 0
    total_score = 0

    for i, s in enumerate(sentences):
        user_text = answer_map.get(i, "").strip()
        expected = s.get("text_nl", "")
        english = s.get("text_en", "")
        hint_count = hints_used[i] if i < len(hints_used) else 0

        if not user_text:
            results.append({
                "sentence_index": i,
                "text_en": english,
                "text_nl": expected,
                "user_text": "",
                "correct": False,
                "score": 0,
                "errors": [],
                "alternative_accepted": False,
                "feedback_nl": "Geen antwoord ingevuld.",
                "hints_penalty": 0,
            })
            continue

        # Use AI review
        review = review_translation(english, expected, user_text, hint_count)

        if review["correct"]:
            correct_count += 1

        total_score += review["score"]

        results.append({
            "sentence_index": i,
            "text_en": english,
            "text_nl": expected,
            "user_text": user_text,
            "correct": review["correct"],
            "score": review["score"],
            "errors": review["errors"],
            "alternative_accepted": review["alternative_accepted"],
            "feedback_nl": review["feedback_nl"],
            "hints_penalty": review["hints_penalty"],
        })

    total = len(sentences)
    score = round((correct_count / max(total, 1)) * 100)

    # Collect weak points (repeated grammar rules)
    rule_counts: dict[str, int] = {}
    for r in results:
        for e in r.get("errors", []):
            rule = e.get("rule_nl", "")
            if rule:
                rule_counts[rule] = rule_counts.get(rule, 0) + 1
    weak_points = [rule for rule, count in sorted(rule_counts.items(), key=lambda x: -x[1]) if count >= 1]

    feedback_en, feedback_nl = _generate_spell_feedback(correct_count, total, score)

    return {
        "score": score,
        "correct_count": correct_count,
        "total_sentences": total,
        "results": results,
        "feedback_en": feedback_en,
        "feedback_nl": feedback_nl,
        "weak_points": weak_points,
    }


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
