"""Writing subtopics for Scene Practice — based on DUO A2 Schrijven exam patterns."""

WRITING_SUBTOPICS: dict[str, list[dict]] = {
    "email": [
        {
            "key": "afspraak_verzetten",
            "label_nl": "Afspraak verzetten",
            "label_en": "Reschedule appointment",
            "description": "Write an email to reschedule an appointment (doctor, school meeting, etc). Include reason, propose new time.",
        },
        {
            "key": "dienst_ruilen",
            "label_nl": "Dienst ruilen",
            "label_en": "Swap work shifts",
            "description": "Write an email to a colleague to swap work shifts. Explain which shift and why.",
        },
        {
            "key": "boek_lenen",
            "label_nl": "Iets lenen",
            "label_en": "Borrow something",
            "description": "Write an email to ask someone if you can borrow something (book, tool, item). Say when you'll return it.",
        },
        {
            "key": "vrije_dag",
            "label_nl": "Vrije dag aanvragen",
            "label_en": "Request day off",
            "description": "Write an email to your manager/boss to request a day off. Include the date and reason.",
        },
        {
            "key": "email_docent",
            "label_nl": "Email aan docent",
            "label_en": "Email to teacher",
            "description": "Write an email to a teacher about a course, homework, or absence. Be polite and clear.",
        },
        {
            "key": "ziek_melden",
            "label_nl": "Ziek melden",
            "label_en": "Call in sick",
            "description": "Write an email to report that you are sick and cannot come to work/school. Say what's wrong and when you expect to return.",
        },
        {
            "key": "informatie_vragen",
            "label_nl": "Informatie vragen",
            "label_en": "Ask for information",
            "description": "Write an email to ask for information (about a course, event, service). Include specific questions.",
        },
        {
            "key": "klacht",
            "label_nl": "Klacht schrijven",
            "label_en": "Write a complaint",
            "description": "Write an email to complain about a product, service, or situation. Describe the problem and what you want.",
        },
    ],
    "kort_verhaal": [
        {
            "key": "feest",
            "label_nl": "Een feest",
            "label_en": "A party/celebration",
            "description": "Write about a party or celebration you attended or organized. What happened? Who was there?",
        },
        {
            "key": "mooiste_kleren",
            "label_nl": "Mooiste kleren",
            "label_en": "Favourite clothes",
            "description": "Write about your favourite clothes. What do you like to wear? When do you wear them?",
        },
        {
            "key": "weekend",
            "label_nl": "Mijn weekend",
            "label_en": "My weekend",
            "description": "Write about what you did last weekend or what you usually do on weekends.",
        },
        {
            "key": "hobby",
            "label_nl": "Mijn hobby",
            "label_en": "My hobby",
            "description": "Write about your hobby. What is it? How often do you do it? Why do you like it?",
        },
        {
            "key": "buurt",
            "label_nl": "Mijn buurt",
            "label_en": "My neighbourhood",
            "description": "Write about your neighbourhood. What is there? What do you like/dislike about it?",
        },
        {
            "key": "dagelijkse_routine",
            "label_nl": "Dagelijkse routine",
            "label_en": "Daily routine",
            "description": "Write about your daily routine. What time do you wake up? What do you do during the day?",
        },
        {
            "key": "vakantie",
            "label_nl": "Vakantie",
            "label_en": "Holiday",
            "description": "Write about a holiday you had or want to have. Where did you go? What did you do?",
        },
    ],
    "formulier": [
        {
            "key": "sportschool",
            "label_nl": "Sportschool aanmelden",
            "label_en": "Gym registration",
            "description": "Fill in a gym/sports club registration form with personal details and preferences.",
        },
        {
            "key": "ingebroken",
            "label_nl": "Aangifte inbraak",
            "label_en": "Burglary report",
            "description": "Fill in a report form because someone broke into your house. Describe what happened and what was stolen.",
        },
        {
            "key": "problemen_straat",
            "label_nl": "Melding problemen straat",
            "label_en": "Street problem report",
            "description": "Fill in a form to report a problem in your street (broken streetlight, trash, etc).",
        },
        {
            "key": "cursus_aanmelden",
            "label_nl": "Cursus aanmelden",
            "label_en": "Course registration",
            "description": "Fill in a registration form for a course (language, computer, cooking, etc).",
        },
        {
            "key": "bibliotheek",
            "label_nl": "Bibliotheek inschrijven",
            "label_en": "Library registration",
            "description": "Fill in a library membership form with personal information and preferences.",
        },
    ],
    "briefje": [
        {
            "key": "bericht_collega",
            "label_nl": "Bericht aan collega",
            "label_en": "Note to colleague",
            "description": "Write a short note to a colleague about tasks, a meeting, or something they need to know.",
        },
        {
            "key": "bericht_buren",
            "label_nl": "Bericht aan buren",
            "label_en": "Note to neighbours",
            "description": "Write a short note to your neighbours about noise, a package, a party, or something else.",
        },
        {
            "key": "bericht_familie",
            "label_nl": "Bericht aan familie",
            "label_en": "Note to family",
            "description": "Write a short note to a family member about errands, plans, or something they need to do.",
        },
    ],
}


def get_subtopic(task_type: str, key: str) -> dict | None:
    """Look up a subtopic by task_type and key."""
    for st in WRITING_SUBTOPICS.get(task_type, []):
        if st["key"] == key:
            return st
    return None
