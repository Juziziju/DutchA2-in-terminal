"""Curated A2 Dutch grammar rules reference — used in AI prompts to prevent hallucinated explanations."""

GRAMMAR_RULES: dict[str, dict] = {
    "de_het": {
        "rule_en": "Dutch nouns use either 'de' (common gender) or 'het' (neuter). You must memorize which article each noun takes.",
        "examples": ["de school (not het school)", "het huis (not de huis)", "de kat, het kind"],
        "tip": "About 2/3 of Dutch nouns use 'de'. Diminutives (-je) always use 'het'.",
    },
    "verb_conjugation": {
        "rule_en": "Dutch verbs change form by person: ik werk, jij werkt, hij/zij werkt, wij/jullie/zij werken. In past tense: regular verbs use -te/-de or -ten/-den.",
        "examples": ["ik ga (not ik gaat)", "hij loopt (not hij lopen)", "wij werken (not wij werkt)"],
        "tip": "For 'jij/hij/zij' in present tense, add -t to the stem. With inversion ('werk jij?'), drop the -t.",
    },
    "word_order": {
        "rule_en": "Dutch main clauses use V2 (verb-second) word order. After a time/place phrase at the start, the verb stays in position 2 and the subject moves after it.",
        "examples": [
            "Gisteren ging ik naar school. (not Gisteren ik ging...)",
            "Morgen gaan wij naar Amsterdam.",
        ],
        "tip": "In subordinate clauses (with dat, omdat, als, etc.), the verb goes to the END.",
    },
    "spelling": {
        "rule_en": "Dutch spelling follows strict open/closed syllable rules. A single vowel in an open syllable is long (ma-ken), in a closed syllable is short (mak-ken → doubled consonant).",
        "examples": ["maken (long a, open syllable)", "bakken (short a, closed syllable)", "lopen vs. loppen"],
        "tip": "When adding -en or -e, check if the syllable stays open or closed to keep the vowel sound correct.",
    },
    "plural": {
        "rule_en": "Most Dutch plurals add -en (boek → boeken). Words ending in -el, -em, -en, -er, -e often add -s. Some have irregular plurals.",
        "examples": ["boek → boeken", "tafel → tafels", "kind → kinderen (irregular)"],
        "tip": "When adding -en, apply spelling rules: 'maan' → 'manen' (drop one a — open syllable keeps long vowel).",
    },
    "adjective_inflection": {
        "rule_en": "Adjectives before a noun usually get -e. Exception: with 'een' (or no article) + het-word singular → NO -e.",
        "examples": [
            "de rode auto (de-word → always -e)",
            "een rode auto (de-word → always -e)",
            "het grote huis (het-word with 'het' → -e)",
            "een groot huis (een + het-word → NO -e!)",
        ],
        "tip": "Only skip -e with 'een' + het-word singular: 'een klein kind' but 'het kleine kind'.",
    },
    "preposition": {
        "rule_en": "Dutch prepositions don't translate 1:1 from English. Common ones: in, op, aan, naar, bij, met, van, voor, over, uit.",
        "examples": [
            "op school (at school, not 'aan school')",
            "naar huis (to home, not 'tot huis')",
            "met de trein (by train, not 'bij de trein')",
        ],
        "tip": "Many preposition choices must be memorized. 'Op' is used for days (op maandag) and locations (op school, op kantoor).",
    },
    "article": {
        "rule_en": "Dutch uses 'de' (common), 'het' (neuter), and 'een' (indefinite). No article before professions: 'Ik ben leraar.' Plurals have no indefinite article.",
        "examples": [
            "Ik ben student. (no article before profession)",
            "de kinderen (plural definite)",
            "Ik heb katten. (no 'een' for plural indefinite)",
        ],
        "tip": "'De' is used for plural nouns regardless of their singular article: 'het kind' → 'de kinderen'.",
    },
    "pronoun": {
        "rule_en": "Dutch subject pronouns: ik, jij/je, hij/zij/het, wij/we, jullie, zij/ze. Object pronouns differ: mij/me, jou/je, hem/haar/het, ons, jullie, hen/hun/ze.",
        "examples": [
            "Hij belt mij. (not 'Hij belt ik.')",
            "Ik zie haar. (not 'Ik zie zij.')",
        ],
        "tip": "Subject pronouns (ik, jij, hij) go before the verb. Object pronouns (mij, jou, hem) go after.",
    },
    "capitalization": {
        "rule_en": "In Dutch, capitalize: sentence beginnings, proper nouns, nationalities/languages (Nederlands, Duits), days/months are NOT capitalized (maandag, januari).",
        "examples": [
            "Ik spreek Nederlands. (language → capital)",
            "Op maandag werk ik. (day → lowercase!)",
            "Ik ga in januari op vakantie. (month → lowercase!)",
        ],
        "tip": "Unlike English, Dutch does NOT capitalize days and months. Languages and nationalities ARE capitalized.",
    },
    "punctuation": {
        "rule_en": "Dutch punctuation is similar to English. Commas before subordinate clauses (dat, omdat, als). No comma before 'en' in lists.",
        "examples": [
            "Ik denk, dat hij komt. (comma before 'dat')",
            "appels, peren en bananen (no comma before 'en')",
        ],
        "tip": "Use a comma before subordinating conjunctions: omdat, dat, als, wanneer, terwijl.",
    },
    "other": {
        "rule_en": "Other common A2 errors include: er/daar usage, reflexive verbs (zich wassen), separable verbs (opbellen → ik bel op), and diminutives (-je).",
        "examples": [
            "Ik bel je morgen op. (separable: op + bellen)",
            "Hij wast zich. (reflexive: zich wassen)",
        ],
        "tip": "Separable verbs split in main clauses: the prefix goes to the end. In subordinate clauses they stay together.",
    },
}


def format_rules_for_prompt() -> str:
    """Format all grammar rules into a concise reference block for AI prompts."""
    lines = ["## Dutch A2 Grammar Rules Reference\n"]
    for cat, info in GRAMMAR_RULES.items():
        lines.append(f"### {cat}")
        lines.append(f"Rule: {info['rule_en']}")
        lines.append(f"Examples: {'; '.join(info['examples'])}")
        lines.append(f"Tip: {info['tip']}\n")
    return "\n".join(lines)


def get_rule_for_category(category: str) -> dict | None:
    """Get the grammar rule dict for a specific error category."""
    return GRAMMAR_RULES.get(category)
