"""AI generation for writing prompts and grading — DUO A2 Schrijven format."""

import json
import time

from backend.config import DASHSCOPE_API_KEY
from backend.core.qwen import CONTENT_MODEL
from backend.core.grammar_rules import format_rules_for_prompt, get_rule_for_category

ERROR_CATEGORIES = [
    "de_het", "verb_conjugation", "word_order", "spelling",
    "plural", "adjective_inflection", "preposition", "article",
    "pronoun", "capitalization", "punctuation", "other",
]

TASK_TYPE_CONFIGS = {
    "email": {
        "desc": "Write a formal or informal email",
        "prompt_schema": """{{
  "task_type": "email",
  "topic": "English topic description",
  "situation_nl": "Dutch situation description (2-3 sentences)",
  "situation_en": "English translation of situation",
  "recipient": "Name of the person to write to",
  "bullet_points": [
    {{"nl": "Dutch instruction", "en": "English translation"}},
    {{"nl": "Dutch instruction", "en": "English translation"}},
    {{"nl": "Dutch instruction", "en": "English translation"}}
  ],
  "model_answer": "A complete model email in Dutch"
}}""",
        "requirements": "- 3-4 bullet points the student must address\n- Situation should be realistic (reschedule appointment, ask for info, complain, etc.)\n- Model answer should use proper greeting/closing",
    },
    "kort_verhaal": {
        "desc": "Write a short text (≥3 sentences) about a topic",
        "prompt_schema": """{{
  "task_type": "kort_verhaal",
  "topic": "English topic description",
  "topic_nl": "Dutch topic (e.g. 'Mijn weekend')",
  "topic_en": "English topic",
  "guiding_questions": [
    {{"nl": "Dutch question?", "en": "English translation?"}},
    {{"nl": "Dutch question?", "en": "English translation?"}},
    {{"nl": "Dutch question?", "en": "English translation?"}}
  ],
  "model_answer": "A complete model short text in Dutch (4-6 sentences)"
}}""",
        "requirements": "- 3 guiding questions to help structure the answer\n- Topics: weekend, hobby, vacation, daily routine, neighbourhood, etc.\n- Model answer should be 4-6 sentences, A2 level",
    },
    "formulier": {
        "desc": "Fill in a structured form with some free-text fields",
        "prompt_schema": """{{
  "task_type": "formulier",
  "topic": "English topic description",
  "situation_nl": "Dutch situation (why filling this form)",
  "situation_en": "English translation of situation",
  "form_title_nl": "Dutch form title",
  "form_title_en": "English form title",
  "fields": [
    {{"label_nl": "Naam", "label_en": "Name", "field_type": "text", "placeholder": ""}},
    {{"label_nl": "Geboortedatum", "label_en": "Date of birth", "field_type": "text", "placeholder": "dd-mm-jjjj"}},
    {{"label_nl": "Geslacht", "label_en": "Gender", "field_type": "select", "options": ["Man", "Vrouw", "Anders"]}},
    {{"label_nl": "Waarom wilt u meedoen?", "label_en": "Why do you want to participate?", "field_type": "textarea", "placeholder": ""}}
  ],
  "model_answers": {{
    "Naam": "Jan de Vries",
    "Geboortedatum": "15-03-1990",
    "Geslacht": "Man",
    "Waarom wilt u meedoen?": "Ik wil graag meedoen omdat ik meer wil bewegen. Ik vind het ook leuk om nieuwe mensen te ontmoeten."
  }}
}}""",
        "requirements": "- 5-8 fields: mix of text, select, and textarea\n- At least 1-2 textarea fields requiring free-text answers\n- Realistic form (sports club, library card, course registration, complaint, etc.)\n- Model answers for ALL fields",
    },
}

REVIEW_SCHEMA = """{
  "score": 75,
  "grammar_score": 70,
  "vocabulary_score": 80,
  "completeness_score": 75,
  "grammar_errors": [
    {
      "text": "original text with error",
      "correction": "corrected text",
      "category": "preposition",
      "explanation_en": "Explanation in English why this is wrong and the correction"
    }
  ],
  "feedback_nl": "Korte feedback in het Nederlands",
  "feedback_en": "Short feedback in English",
  "improved_answer": "The student's full text rewritten correctly in Dutch"
}"""


def _get_client():
    from openai import OpenAI
    return OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


def _strip_fences(raw: str) -> str:
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return raw


def generate_writing_prompt(task_type: str = "email", topic: str = "", weak_categories: list[str] | None = None) -> dict:
    """Generate a writing prompt. Optionally bias toward user's weak grammar areas."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    cfg = TASK_TYPE_CONFIGS.get(task_type, TASK_TYPE_CONFIGS["email"])

    weak_line = ""
    if weak_categories:
        cats = ", ".join(weak_categories[:5])
        weak_line = (
            f"\n\nIMPORTANT: The student frequently makes these grammar errors: {cats}. "
            f"Generate a writing prompt that will likely require using these grammar patterns "
            f"so the student gets practice with their weak areas."
        )

    topic_line = f"\n- The topic MUST be about: {topic}" if topic else ""

    system = f"""You are a Dutch A2 writing exam teacher creating exercises for the DUO Inburgering Schrijven exam.
Generate a {cfg['desc']} prompt at A2 level.
Return ONLY valid JSON with no markdown fences.

Schema:
{cfg['prompt_schema']}

Requirements:
{cfg['requirements']}
- All Dutch text must be A2 level
- Include both Dutch and English where specified{topic_line}{weak_line}"""

    user_msg = f"Create a Dutch A2 writing prompt ({task_type}). Return only valid JSON."
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
            raw = _strip_fences(response.choices[0].message.content.strip())
            data = json.loads(raw)
            # Basic validation
            if "topic" not in data:
                raise ValueError("Missing 'topic' in response")
            data["task_type"] = task_type
            return data
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)

    raise RuntimeError(f"Writing prompt generation failed after 2 attempts: {last_err}")


def review_writing(task_type: str, prompt: dict, user_response: str) -> dict:
    """Grade user's writing submission with AI. Returns structured feedback."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    # Build context from prompt
    if task_type == "email":
        context = (
            f"Task: Write an email\n"
            f"Situation: {prompt.get('situation_nl', '')}\n"
            f"Recipient: {prompt.get('recipient', '')}\n"
            f"Requirements:\n" +
            "\n".join(f"- {bp.get('nl', bp) if isinstance(bp, dict) else bp}" for bp in prompt.get("bullet_points", []))
        )
    elif task_type == "kort_verhaal":
        context = (
            f"Task: Write a short text about: {prompt.get('topic_nl', prompt.get('topic', ''))}\n"
            f"Guiding questions:\n" +
            "\n".join(f"- {q.get('nl', q) if isinstance(q, dict) else q}" for q in prompt.get("guiding_questions", []))
        )
    else:  # formulier
        context = (
            f"Task: Fill in form: {prompt.get('form_title_nl', '')}\n"
            f"Situation: {prompt.get('situation_nl', '')}"
        )

    error_cats = ", ".join(ERROR_CATEGORIES)
    grammar_ref = format_rules_for_prompt()
    system = f"""You are a Dutch A2 writing exam grader for the DUO Inburgering Schrijven exam.
Grade the student's writing based on: grammar, vocabulary, and completeness (did they address all requirements).

For grammar_errors, each error MUST have a "category" from this list: {error_cats}

{grammar_ref}

IMPORTANT — for each grammar error, explanation_en MUST:
1. Quote the error and correction
2. Cite the correct rule from the grammar reference above
3. Give a brief example
Do NOT invent grammar rules. Use the reference above.

Return ONLY valid JSON matching this schema:
{REVIEW_SCHEMA}

Scoring guide:
- score: overall 0-100
- grammar_score: 0-100 (verb conjugation, articles, word order, spelling)
- vocabulary_score: 0-100 (appropriate word choice, variety, A2 level)
- completeness_score: 0-100 (all bullet points/questions addressed, proper format)

Be encouraging but honest. Focus on A2-level expectations."""

    user_msg = f"""Grade this Dutch A2 writing submission.

{context}

Model answer:
{prompt.get('model_answer', prompt.get('model_answers', 'N/A'))}

Student's response:
{user_response}

Return only valid JSON."""

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
                temperature=0.3,
            )
            raw = _strip_fences(response.choices[0].message.content.strip())
            data = json.loads(raw)
            # Ensure required fields
            data.setdefault("score", 0)
            data.setdefault("grammar_score", 0)
            data.setdefault("vocabulary_score", 0)
            data.setdefault("completeness_score", 0)
            data.setdefault("grammar_errors", [])
            data.setdefault("feedback_nl", "")
            data.setdefault("feedback_en", "")
            data.setdefault("improved_answer", "")
            # Normalize error categories
            for err in data["grammar_errors"]:
                if err.get("category") not in ERROR_CATEGORIES:
                    err["category"] = "other"
            return data
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)

    raise RuntimeError(f"Writing review failed after 2 attempts: {last_err}")


# ── Error Correction (改错) ─────────────────────────────────────────────────


def _postvalidate_explanation(sentence: dict, category: str) -> None:
    """Check if the AI explanation references the correct grammar rule; replace if not."""
    rule = get_rule_for_category(category)
    if not rule:
        return
    explanation = sentence.get("explanation_en") or ""
    # Check if the explanation contains key terms from the rule
    rule_text = rule["rule_en"].lower()
    # Extract a few key phrases to check against
    key_terms = {
        "de_het": ["de", "het", "common", "neuter"],
        "verb_conjugation": ["conjugat", "verb", "person", "stem", "-t"],
        "word_order": ["v2", "verb-second", "word order", "position 2", "verb stays"],
        "spelling": ["syllable", "spelling", "open", "closed", "double"],
        "plural": ["plural", "-en", "-s"],
        "adjective_inflection": ["-e", "adjective", "een", "het-word"],
        "preposition": ["preposition"],
        "article": ["article", "de", "het", "een"],
        "pronoun": ["pronoun", "subject", "object"],
        "capitalization": ["capital", "uppercase", "lowercase"],
        "punctuation": ["comma", "punctuation"],
        "other": [],
    }
    terms = key_terms.get(category, [])
    if not terms:
        return
    explanation_lower = explanation.lower()
    # If at least one key term is present, the explanation is probably fine
    if any(term in explanation_lower for term in terms):
        return
    # Replace with a rule-based explanation
    error_text = sentence.get("text", "")
    correct_text = sentence.get("correct_text", "")
    example = rule["examples"][0] if rule["examples"] else ""
    sentence["explanation_en"] = (
        f"'{error_text}' should be '{correct_text}'. "
        f"{rule['rule_en']} Example: {example}."
    )


def generate_error_correction(topic: str = "", weak_categories: list[str] | None = None) -> dict:
    """Generate sentence-by-sentence error correction exercise at A2 level.

    Returns sentences[] where each has has_error flag. Some are correct, some
    have one obvious A2 grammar mistake. Student judges each sentence and
    rewrites the wrong ones.
    """
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    error_cats = ", ".join(ERROR_CATEGORIES)
    weak_line = ""
    if weak_categories:
        cats = ", ".join(weak_categories[:5])
        weak_line = (
            f"\n\nThe student is weak in: {cats}. "
            f"Focus most errors on these categories."
        )

    topic_line = f"\n- Topic MUST be about: {topic}" if topic else ""

    grammar_ref = format_rules_for_prompt()

    system = f"""You are a Dutch A2 language teacher creating an error correction exercise for beginners.
Generate 8 simple Dutch sentences at A2 level about an everyday topic.
- 5 sentences have exactly ONE obvious grammar error each (common A2 mistakes)
- 3 sentences are completely correct

The errors should be EASY to spot for A2 students: wrong de/het, wrong verb form,
wrong word order, misspelling, wrong preposition, etc. Keep sentences short (8-15 words).

Error categories: {error_cats}

{grammar_ref}

IMPORTANT — explanation_en format:
"[What's wrong]: '[error]' should be '[correct]'. [Rule from the grammar reference above]. Example: '[example]'."
You MUST use the correct rule from the reference above. Do NOT invent grammar rules.

Return ONLY valid JSON:
{{
  "task_type": "error_correction",
  "topic": "English topic description",
  "topic_nl": "Dutch topic",
  "topic_en": "English topic",
  "sentences": [
    {{
      "text": "Ik heb gisteren een nieuwe fiets gekocht.",
      "text_en": "I bought a new bicycle yesterday.",
      "has_error": false,
      "correct_text": "Ik heb gisteren een nieuwe fiets gekocht.",
      "category": null,
      "explanation_en": null
    }},
    {{
      "text": "Hij gaat naar het school elke dag.",
      "text_en": "He goes to school every day.",
      "has_error": true,
      "correct_text": "Hij gaat naar de school elke dag.",
      "category": "de_het",
      "explanation_en": "Wrong article: 'het school' should be 'de school'. Dutch nouns use either 'de' (common) or 'het' (neuter) — 'school' is a de-word. Example: de school, de kat."
    }}
  ]
}}

Requirements:
- A2 level: simple vocabulary, present/past tense, everyday topics
- Short sentences (8-15 words each), easy to read
- Exactly 5 sentences WITH errors and 3 sentences WITHOUT errors
- Mix them randomly (don't put all correct ones together)
- Each error is ONE single clear mistake, not subtle
- Each sentence MUST have a "text_en" field with its English translation
- explanation_en MUST cite the correct grammar rule from the reference above{topic_line}{weak_line}"""

    user_msg = "Create a beginner-friendly error correction exercise. Return only valid JSON."
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
                temperature=0.5,
            )
            raw = _strip_fences(response.choices[0].message.content.strip())
            data = json.loads(raw)
            if "sentences" not in data or len(data["sentences"]) < 4:
                raise ValueError("Missing or too few sentences")
            data["task_type"] = "error_correction"
            # Normalize categories and post-validate explanations
            for s in data.get("sentences", []):
                if s.get("has_error"):
                    cat = s.get("category", "other")
                    if cat not in ERROR_CATEGORIES:
                        cat = "other"
                        s["category"] = cat
                    # Ensure text_en exists
                    s.setdefault("text_en", "")
                    # Post-validate: if explanation doesn't reference the correct rule, replace it
                    _postvalidate_explanation(s, cat)
                else:
                    s.setdefault("text_en", "")
            return data
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)

    raise RuntimeError(f"Error correction generation failed after 2 attempts: {last_err}")


def _normalize(text: str) -> str:
    """Normalize text for comparison: lowercase, strip, collapse spaces, remove trailing punctuation."""
    import re
    t = text.lower().strip()
    t = re.sub(r"\s+", " ", t)
    t = t.rstrip(".,;:!?")
    return t


def _correction_matches(user_fix: str, expected: str) -> bool:
    """Check if user's correction is close enough to the expected correction.

    Uses normalized exact match + allows minor differences (1 char Levenshtein).
    """
    u = _normalize(user_fix)
    e = _normalize(expected)
    if not u or not e:
        return False
    if u == e:
        return True
    # Allow Levenshtein distance ≤ 1 (one typo)
    if abs(len(u) - len(e)) > 1:
        return False
    # Simple Levenshtein ≤ 1 check
    if len(u) == len(e):
        return sum(a != b for a, b in zip(u, e)) <= 1
    shorter, longer = (u, e) if len(u) < len(e) else (e, u)
    j = 0
    diffs = 0
    for i in range(len(longer)):
        if j < len(shorter) and longer[i] == shorter[j]:
            j += 1
        else:
            diffs += 1
        if diffs > 1:
            return False
    return True


def _ai_check_correction(client, user_fix: str, expected: str, sentence: str) -> bool:
    """Use AI to check if a user correction acceptably fixes the error.

    Only called when simple string matching fails — handles rephrasing.
    """
    try:
        response = client.chat.completions.create(
            model=CONTENT_MODEL,
            messages=[
                {"role": "system", "content": "You judge if a student's Dutch correction fixes the grammar error. Reply ONLY 'yes' or 'no'."},
                {"role": "user", "content": (
                    f"Original (with error): \"{sentence}\"\n"
                    f"Expected correction: \"{expected}\"\n"
                    f"Student wrote: \"{user_fix}\"\n\n"
                    f"Does the student's version fix the grammar error? Reply only 'yes' or 'no'."
                )},
            ],
            temperature=0.0,
        )
        answer = response.choices[0].message.content.strip().lower()
        return answer.startswith("yes") or answer.startswith("ja")
    except Exception:
        return False


def grade_error_correction(prompt: dict, user_answers: list[dict]) -> dict:
    """Grade sentence-by-sentence error correction deterministically.

    Ground truth (has_error, correct_text, category, explanation) comes from the
    generation prompt — never re-judged by AI. AI is only used for fuzzy-matching
    user corrections when simple string matching fails.

    user_answers: [{ sentence_index, marked_error: bool, user_correction: str|null }]
    """
    sentences = prompt.get("sentences", [])
    total_errors = sum(1 for s in sentences if s.get("has_error"))

    # Build answer map
    answer_map: dict[int, dict] = {}
    for a in user_answers:
        answer_map[a.get("sentence_index", -1)] = a

    # Only create AI client if we need fuzzy matching
    client = None

    results = []
    found_count = 0
    correct_fixes = 0
    correct_judgments = 0

    for i, s in enumerate(sentences):
        ua = answer_map.get(i, {})
        user_marked = ua.get("marked_error", False)
        user_fix = (ua.get("user_correction") or "").strip()
        has_error = s.get("has_error", False)
        correct_text = s.get("correct_text", s["text"])
        category = s.get("category")
        explanation = s.get("explanation_en", "")

        result: dict = {
            "sentence": s["text"],
            "has_error": has_error,
            "correct_text": correct_text,
            "category": category if has_error else None,
            "explanation_en": explanation if has_error else None,
            "user_marked_error": user_marked,
            "user_correction": user_fix if user_marked else None,
            "found": None,
            "fix_correct": None,
        }

        if has_error:
            # Sentence has an error — did student find it?
            if user_marked:
                result["found"] = True
                found_count += 1
                # Check if user's fix is correct
                if _correction_matches(user_fix, correct_text):
                    result["fix_correct"] = True
                    correct_fixes += 1
                    correct_judgments += 1
                elif user_fix:
                    # Fuzzy match via AI
                    if client is None:
                        client = _get_client()
                    is_ok = _ai_check_correction(client, user_fix, correct_text, s["text"])
                    result["fix_correct"] = is_ok
                    if is_ok:
                        correct_fixes += 1
                        correct_judgments += 1
                else:
                    result["fix_correct"] = False
            else:
                result["found"] = False
                # Student missed the error — no points
        else:
            # Sentence is correct
            if not user_marked:
                # Student correctly left it alone
                correct_judgments += 1
            # else: false alarm — no points

        results.append(result)

    # Compute score deterministically
    if total_errors > 0:
        score = round(
            (correct_fixes / total_errors) * 70
            + (correct_judgments / len(sentences)) * 30
        )
    else:
        score = round((correct_judgments / max(len(sentences), 1)) * 100)

    # Generate feedback summary
    feedback_en, feedback_nl = _generate_ec_feedback(
        found_count, total_errors, correct_fixes, correct_judgments, len(sentences), score
    )

    return {
        "score": score,
        "found_count": found_count,
        "total_errors": total_errors,
        "correct_fixes": correct_fixes,
        "correct_judgments": correct_judgments,
        "total_sentences": len(sentences),
        "results": results,
        "feedback_en": feedback_en,
        "feedback_nl": feedback_nl,
    }


def _generate_ec_feedback(
    found: int, total_errors: int, fixes: int, judgments: int, total: int, score: int
) -> tuple[str, str]:
    """Generate short feedback strings without AI."""
    # English
    parts_en = []
    if score >= 80:
        parts_en.append("Great job!")
    elif score >= 60:
        parts_en.append("Good effort!")
    else:
        parts_en.append("Keep practicing!")

    parts_en.append(f"You found {found} out of {total_errors} errors.")
    if fixes < found:
        parts_en.append(f"You correctly fixed {fixes} of them — try to rewrite more carefully.")
    elif fixes == total_errors:
        parts_en.append("All your corrections were spot on!")
    missed = total_errors - found
    if missed > 0:
        parts_en.append(f"You missed {missed} error{'s' if missed > 1 else ''} — review the explanations below.")
    false_alarms = sum(1 for _ in range(total) if _ >= 0) - judgments - missed  # approximate
    feedback_en = " ".join(parts_en)

    # Dutch (simple A2)
    parts_nl = []
    if score >= 80:
        parts_nl.append("Heel goed gedaan!")
    elif score >= 60:
        parts_nl.append("Goed geprobeerd!")
    else:
        parts_nl.append("Blijf oefenen!")
    parts_nl.append(f"Je hebt {found} van de {total_errors} fouten gevonden.")
    if fixes == total_errors:
        parts_nl.append("Alle correcties waren goed!")
    feedback_nl = " ".join(parts_nl)

    return feedback_en, feedback_nl
