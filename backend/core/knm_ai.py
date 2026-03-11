"""AI generation for KNM (Kennis van de Nederlandse Maatschappij) practice questions."""

import json
import time

from backend.config import DASHSCOPE_API_KEY
from backend.core.qwen import CONTENT_MODEL

KNM_CATEGORIES = {
    "werk": {
        "label_nl": "Werk",
        "label_en": "Work",
        "topics": [
            "sick leave and reporting ill",
            "employment contracts and types",
            "UWV and unemployment benefits",
            "salary, minimum wage, and payslips",
            "worker rights and obligations",
            "job interviews and CVs",
        ],
    },
    "gezondheid": {
        "label_nl": "Gezondheid",
        "label_en": "Health",
        "topics": [
            "health insurance (zorgverzekering)",
            "the huisarts (family doctor) system",
            "hospital and specialist referrals",
            "pharmacy and prescriptions",
            "emergency services (112, huisartsenpost)",
            "mental health and GGZ",
        ],
    },
    "geschiedenis": {
        "label_nl": "Geschiedenis & Staatsinrichting",
        "label_en": "History & Government",
        "topics": [
            "parliament (Eerste/Tweede Kamer)",
            "the King and royal family",
            "elections and voting",
            "political parties",
            "the Dutch constitution (Grondwet)",
            "World War II and the Holocaust",
            "the Golden Age (Gouden Eeuw)",
            "provinces and municipalities",
        ],
    },
    "omgangsvormen": {
        "label_nl": "Omgangsvormen",
        "label_en": "Social Customs",
        "topics": [
            "greetings and forms of address",
            "birthday traditions (verjaardagskring)",
            "equality between men and women",
            "LGBT rights",
            "punctuality and appointments",
            "directness in Dutch communication",
        ],
    },
    "wonen": {
        "label_nl": "Wonen",
        "label_en": "Housing",
        "topics": [
            "social housing (sociale huurwoning)",
            "rental agreements and tenant rights",
            "the gemeente (municipality) and civil affairs",
            "waste separation and recycling",
            "dealing with neighbors",
            "registering at the gemeente (BRP)",
        ],
    },
    "onderwijs": {
        "label_nl": "Onderwijs",
        "label_en": "Education",
        "topics": [
            "compulsory education (leerplicht)",
            "school types (basisschool, vmbo, havo, vwo, mbo)",
            "higher education (hbo, universiteit)",
            "inburgering and integration courses",
            "school fees and DUO",
            "childcare (kinderopvang)",
        ],
    },
    "financien": {
        "label_nl": "Financi\u00ebn",
        "label_en": "Finances",
        "topics": [
            "tax system and Belastingdienst",
            "DigiD and online government services",
            "banking and payment (iDEAL, pin)",
            "insurance types",
            "subsidies (huurtoeslag, zorgtoeslag, kinderbijslag)",
            "debt assistance (schuldhulpverlening)",
        ],
    },
}


def _get_client():
    from openai import OpenAI
    return OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


def generate_knm_questions(category: str, count: int = 5) -> list[dict]:
    """Generate KNM practice questions for a category. Retries once on failure."""
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    cat_info = KNM_CATEGORIES.get(category)
    if not cat_info:
        raise ValueError(f"Unknown KNM category: {category}")

    topics_str = ", ".join(cat_info["topics"])
    client = _get_client()

    system = f"""You are a Dutch civic integration (KNM) exam teacher.
Generate {count} practice questions about {cat_info['label_en']} ({cat_info['label_nl']}).
Return ONLY valid JSON with no markdown fences.

Schema — a JSON array:
[
  {{
    "id": "q1",
    "question_nl": "Dutch question text (A2 level Dutch)...",
    "question_en": "English translation...",
    "context_nl": "Optional 1-2 sentence scenario in Dutch (or empty string)",
    "context_en": "English translation of context (or empty string)",
    "options": {{"A": "Dutch option", "B": "Dutch option", "C": "Dutch option"}},
    "options_en": {{"A": "English translation", "B": "English translation", "C": "English translation"}},
    "answer": "B",
    "explanation_en": "Detailed explanation with relevant Dutch law/custom..."
  }}
]

Requirements:
- Exactly {count} questions
- 3 options per question (A/B/C), matching real KNM exam format
- Questions in A2-level Dutch
- Cover different sub-topics from: {topics_str}
- Explanations must be factually accurate about Dutch laws and customs
- Include context/scenario when it helps (e.g., "You receive a letter from the gemeente...")
- Each question tests practical knowledge needed for integration"""

    user_msg = f"Generate {count} KNM questions about {cat_info['label_en']}. Return only valid JSON array."

    last_err = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=CONTENT_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.7,
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(raw)
            if not isinstance(data, list) or len(data) != count:
                raise ValueError(f"Expected {count} questions, got {len(data) if isinstance(data, list) else 'non-list'}")
            for i, q in enumerate(data):
                for key in ("id", "question_nl", "question_en", "options", "answer", "explanation_en"):
                    if key not in q:
                        raise ValueError(f"questions[{i}] missing '{key}'")
                if q["answer"] not in ("A", "B", "C"):
                    raise ValueError(f"questions[{i}] answer must be A/B/C")
                # Ensure context fields exist
                q.setdefault("context_nl", "")
                q.setdefault("context_en", "")
                q.setdefault("options_en", {})
            return data
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(2)

    raise RuntimeError(f"KNM generation failed after 2 attempts: {last_err}")
