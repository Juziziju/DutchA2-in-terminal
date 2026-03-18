"""Vocabulary scene/category mapping for Dutch A2 words."""

import json
import logging

logger = logging.getLogger(__name__)

CATEGORIES = [
    "General",
    "Greetings & Phrases",
    "Family & People",
    "Food & Drink",
    "Shopping & Money",
    "Numbers",
    "Time & Calendar",
    "Colors",
    "Places & Directions",
    "Countries & Nationality",
    "Transport & Travel",
    "Daily Life",
    "Sports & Hobbies",
    "Describing Things",
    "Language & Communication",
    "Weather & Seasons",
    "Celebrations",
    "Hotel & Accommodation",
]

# fmt: off
CATEGORY_MAP: dict[str, str] = {
    # ── Greetings & Phrases ──────────────────────────────────────────────────
    "Hoi!":                        "Greetings & Phrases",
    "goedemorgen":                 "Greetings & Phrases",
    "goedemiddag":                 "Greetings & Phrases",
    "Goedemiddag!":                "Greetings & Phrases",
    "goedenavond":                 "Greetings & Phrases",
    "Aangenaam!":                  "Greetings & Phrases",
    "Prima!":                      "Greetings & Phrases",
    "Het gaat goed.":              "Greetings & Phrases",
    "Hoe gaat het?":               "Greetings & Phrases",
    "En jij?":                     "Greetings & Phrases",
    "En met jou?":                 "Greetings & Phrases",
    "dankjewel":                   "Greetings & Phrases",
    "alsjeblieft":                 "Greetings & Phrases",
    "sorry":                       "Greetings & Phrases",
    "ja":                          "Greetings & Phrases",
    "nee":                         "Greetings & Phrases",
    "geen probleem":               "Greetings & Phrases",
    "Ja, natuurlijk!":             "Greetings & Phrases",
    "Ja, graag!":                  "Greetings & Phrases",
    "Nee, sorry.":                 "Greetings & Phrases",
    "Jeetje!":                     "Greetings & Phrases",
    "Nou...":                      "Greetings & Phrases",
    "Kom binnen!":                 "Greetings & Phrases",
    "Dit is...":                   "Greetings & Phrases",
    "Het is...":                   "Greetings & Phrases",

    # ── Family & People ──────────────────────────────────────────────────────
    "de moeder":                   "Family & People",
    "de vader":                    "Family & People",
    "de broer":                    "Family & People",
    "de zus":                      "Family & People",
    "de oma":                      "Family & People",
    "de opa":                      "Family & People",
    "de hond":                     "Family & People",
    "de kat":                      "Family & People",
    "de dochter":                  "Family & People",
    "de zoon":                     "Family & People",
    "mijn ouders":                 "Family & People",
    "hun ouders":                  "Family & People",
    "jullie ouders":               "Family & People",
    "onze kinderen":               "Family & People",
    "haar vader":                  "Family & People",
    "zijn dochter":                "Family & People",
    "je zus / jouw zus":           "Family & People",
    "gescheiden":                  "Family & People",
    "getrouwd":                    "Family & People",
    "meneer":                      "Family & People",
    "mevrouw":                     "Family & People",

    # ── Food & Drink ─────────────────────────────────────────────────────────
    "aardappel":                   "Food & Drink",
    "appel":                       "Food & Drink",
    "banaan":                      "Food & Drink",
    "brood":                       "Food & Drink",
    "broodje":                     "Food & Drink",
    "boterham":                    "Food & Drink",
    "beleg":                       "Food & Drink",
    "ham":                         "Food & Drink",
    "kaas":                        "Food & Drink",
    "tomaat":                      "Food & Drink",
    "groente":                     "Food & Drink",
    "fruit":                       "Food & Drink",
    "vis":                         "Food & Drink",
    "vlees":                       "Food & Drink",
    "stamppot":                    "Food & Drink",
    "patat":                       "Food & Drink",
    "friet":                       "Food & Drink",
    "bier":                        "Food & Drink",
    "pintje":                      "Food & Drink",
    "wijn":                        "Food & Drink",
    "koffie":                      "Food & Drink",
    "thee":                        "Food & Drink",
    "het ontbijt":                 "Food & Drink",
    "de lunch":                    "Food & Drink",
    "het avondeten":               "Food & Drink",
    "de maaltijd":                 "Food & Drink",
    "het toetje":                  "Food & Drink",
    "het koekje":                  "Food & Drink",
    "de hagelslag":                "Food & Drink",
    "het café":                    "Food & Drink",
    "eten":                        "Food & Drink",
    "drinken":                     "Food & Drink",
    "koken":                       "Food & Drink",
    "ontbijten":                   "Food & Drink",
    "lunchen":                     "Food & Drink",
    "bestellen":                   "Food & Drink",
    "Kan ik bestellen?":           "Food & Drink",
    "honger":                      "Food & Drink",
    "Ik heb honger.":              "Food & Drink",
    "dorst":                       "Food & Drink",
    "Ik heb dorst.":               "Food & Drink",
    "lekker":                      "Food & Drink",
    "heerlijk":                    "Food & Drink",
    "vies":                        "Food & Drink",
    "Het eten is lekker.":         "Food & Drink",
    "boodschappen":                "Food & Drink",
    "boodschappen doen":           "Food & Drink",
    "een terrasje pakken":         "Food & Drink",

    # ── Shopping & Money ─────────────────────────────────────────────────────
    "kopen":                       "Shopping & Money",
    "kosten":                      "Shopping & Money",
    "betalen":                     "Shopping & Money",
    "contant betalen":             "Shopping & Money",
    "duur":                        "Shopping & Money",
    "goedkoop":                    "Shopping & Money",
    "de rekening":                 "Shopping & Money",
    "de pinpas":                   "Shopping & Money",
    "de portemonnee":              "Shopping & Money",
    "het geld":                    "Shopping & Money",
    "Hoeveel kost...?":            "Shopping & Money",
    "supermarkt":                  "Shopping & Money",
    "de automaat":                 "Shopping & Money",

    # ── Numbers ──────────────────────────────────────────────────────────────
    "nul":                         "Numbers",
    "één":                         "Numbers",
    "twee":                        "Numbers",
    "drie":                        "Numbers",
    "vier":                        "Numbers",
    "vijf":                        "Numbers",
    "zes":                         "Numbers",
    "zeven":                       "Numbers",
    "acht":                        "Numbers",
    "negen":                       "Numbers",
    "tien":                        "Numbers",
    "elf":                         "Numbers",
    "twaalf":                      "Numbers",
    "dertien":                     "Numbers",
    "veertien":                    "Numbers",
    "zeventien":                   "Numbers",
    "twintig":                     "Numbers",
    "honderd":                     "Numbers",
    "het nummer":                  "Numbers",

    # ── Time & Calendar ──────────────────────────────────────────────────────
    "januari":                     "Time & Calendar",
    "februari":                    "Time & Calendar",
    "maart":                       "Time & Calendar",
    "juni":                        "Time & Calendar",
    "juli":                        "Time & Calendar",
    "augustus":                     "Time & Calendar",
    "september":                   "Time & Calendar",
    "oktober":                     "Time & Calendar",
    "november":                    "Time & Calendar",
    "de dag":                      "Time & Calendar",
    "de week":                     "Time & Calendar",
    "de maand":                    "Time & Calendar",
    "het jaar":                    "Time & Calendar",
    "het uur":                     "Time & Calendar",
    "half uur":                    "Time & Calendar",
    "het weekend":                 "Time & Calendar",
    "vandaag":                     "Time & Calendar",
    "morgen":                      "Time & Calendar",
    "gisteren":                    "Time & Calendar",
    "overmorgen":                  "Time & Calendar",
    "eergisteren":                 "Time & Calendar",
    "straks":                      "Time & Calendar",
    "zo meteen":                   "Time & Calendar",
    "nu":                          "Time & Calendar",
    "vroeg":                       "Time & Calendar",
    "laat":                        "Time & Calendar",
    "op tijd zijn":                "Time & Calendar",
    "te laat zijn":                "Time & Calendar",
    "vaak":                        "Time & Calendar",
    "altijd":                      "Time & Calendar",
    "meestal":                     "Time & Calendar",
    "soms":                        "Time & Calendar",
    "zelden":                      "Time & Calendar",
    "nooit":                       "Time & Calendar",
    "elke":                        "Time & Calendar",
    "vorig":                       "Time & Calendar",
    "volgend":                     "Time & Calendar",
    "vrijdag":                     "Time & Calendar",
    "Hoe laat is het?":            "Time & Calendar",
    "Het is half vijf.":           "Time & Calendar",
    "Hoe vaak...":                 "Time & Calendar",
    "Wanneer?":                    "Time & Calendar",
    "de avond":                    "Time & Calendar",
    "de middag":                   "Time & Calendar",
    "'s avonds":                   "Time & Calendar",
    "'s middags":                  "Time & Calendar",
    "Wat heb je gisteren gedaan?":  "Time & Calendar",
    "op dit moment":               "Time & Calendar",

    # ── Colors ───────────────────────────────────────────────────────────────
    "rood":                        "Colors",
    "blauw":                       "Colors",
    "groen":                       "Colors",
    "geel":                        "Colors",
    "zwart":                       "Colors",
    "wit":                         "Colors",
    "grijs":                       "Colors",
    "bruin":                       "Colors",
    "oranje":                      "Colors",
    "donker":                      "Colors",

    # ── Places & Directions ──────────────────────────────────────────────────
    "de straat":                   "Places & Directions",
    "het centrum":                 "Places & Directions",
    "het postkantoor":             "Places & Directions",
    "het stadhuis":                "Places & Directions",
    "het huis":                    "Places & Directions",
    "het appartement":             "Places & Directions",
    "het adres":                   "Places & Directions",
    "de gracht":                   "Places & Directions",
    "het plein":                   "Places & Directions",
    "de apotheek":                 "Places & Directions",
    "stad":                        "Places & Directions",
    "dorp":                        "Places & Directions",
    "ga links":                    "Places & Directions",
    "ga rechts":                   "Places & Directions",
    "ga rechtdoor":                "Places & Directions",
    "dichtstbijzijnde":            "Places & Directions",
    "open":                        "Places & Directions",
    "gesloten":                    "Places & Directions",
    "druk":                        "Places & Directions",
    "rustig":                      "Places & Directions",
    "de universiteit":             "Places & Directions",
    "de Noordzee":                 "Places & Directions",
    "de molen":                    "Places & Directions",
    "Wij zijn in Leiden.":         "Places & Directions",

    # ── Countries & Nationality ──────────────────────────────────────────────
    "China":                       "Countries & Nationality",
    "Japan":                       "Countries & Nationality",
    "Frankrijk":                   "Countries & Nationality",
    "Duitsland":                   "Countries & Nationality",
    "Engeland":                    "Countries & Nationality",
    "Turkije":                     "Countries & Nationality",
    "België":                      "Countries & Nationality",
    "Belgisch":                    "Countries & Nationality",
    "de Verenigde Staten":         "Countries & Nationality",
    "Zij is Amerikaans.":          "Countries & Nationality",
    "Is zij Engels?":              "Countries & Nationality",
    "Zij zijn Nederlands.":        "Countries & Nationality",
    "Zij komen uit Frankrijk.":    "Countries & Nationality",
    "Waar kom jij vandaan?":       "Countries & Nationality",
    "Waar komen jullie vandaan?":  "Countries & Nationality",
    "komen uit":                   "Countries & Nationality",

    # ── Transport & Travel ───────────────────────────────────────────────────
    "de trein":                    "Transport & Travel",
    "de bus":                      "Transport & Travel",
    "de fiets":                    "Transport & Travel",
    "de auto":                     "Transport & Travel",
    "de taxi":                     "Transport & Travel",
    "de tram":                     "Transport & Travel",
    "de metro":                    "Transport & Travel",
    "de motor":                    "Transport & Travel",
    "de bromfiets":                "Transport & Travel",
    "de bakfiets":                 "Transport & Travel",
    "het vliegtuig":               "Transport & Travel",
    "het treinstation":            "Transport & Travel",
    "het kaartje":                 "Transport & Travel",
    "het perron":                  "Transport & Travel",
    "het spoor":                   "Transport & Travel",
    "het loket":                   "Transport & Travel",
    "het openbaar vervoer":        "Transport & Travel",
    "de halte":                    "Transport & Travel",
    "de gate":                     "Transport & Travel",
    "de bagage":                   "Transport & Travel",
    "de handbagage":               "Transport & Travel",
    "de vertraging":               "Transport & Travel",
    "de vertrektijden":            "Transport & Travel",
    "vertrek":                     "Transport & Travel",
    "aankomst":                    "Transport & Travel",
    "reizen":                      "Transport & Travel",
    "rijden":                      "Transport & Travel",
    "instappen":                   "Transport & Travel",
    "uitstappen":                  "Transport & Travel",
    "vertrekken":                  "Transport & Travel",
    "stoppen":                     "Transport & Travel",
    "annuleren":                   "Transport & Travel",
    "het paspoort":                "Transport & Travel",
    "de douane":                   "Transport & Travel",
    "aangifte goederen":           "Transport & Travel",
    "niets aan te geven":          "Transport & Travel",
    "gaan fietsen":                "Transport & Travel",

    # ── Daily Life ───────────────────────────────────────────────────────────
    "opstaan":                     "Daily Life",
    "wakker worden":               "Daily Life",
    "tanden poetsen":              "Daily Life",
    "gaan slapen":                 "Daily Life",
    "een douche nemen":            "Daily Life",
    "tv kijken":                   "Daily Life",
    "naar het werk gaan":          "Daily Life",
    "naar huis gaan":              "Daily Life",
    "leven":                       "Daily Life",
    "lezen":                       "Daily Life",
    "het boek":                    "Daily Life",
    "de bril":                     "Daily Life",
    "de tas":                      "Daily Life",
    "de sleutels":                 "Daily Life",
    "het mobieltje":               "Daily Life",
    "Wat zit er in je tas?":       "Daily Life",
    "radio's":                     "Daily Life",
    "blijven":                     "Daily Life",
    "nemen":                       "Daily Life",
    "afspreken":                   "Daily Life",
    "alleen":                      "Daily Life",
    "samen":                       "Daily Life",

    # ── Sports & Hobbies ─────────────────────────────────────────────────────
    "het voetbal":                 "Sports & Hobbies",
    "het tennis":                  "Sports & Hobbies",
    "het basketbal":               "Sports & Hobbies",
    "het volleybal":               "Sports & Hobbies",
    "het karate":                  "Sports & Hobbies",
    "de yoga":                     "Sports & Hobbies",
    "de atletiek":                 "Sports & Hobbies",
    "sporten":                     "Sports & Hobbies",
    "gaan zwemmen":                "Sports & Hobbies",
    "gaan schaatsen":              "Sports & Hobbies",
    "gaan dansen":                 "Sports & Hobbies",
    "de bioscoop":                 "Sports & Hobbies",
    "het museum":                  "Sports & Hobbies",
    "de film":                     "Sports & Hobbies",
    "de wedstrijd":                "Sports & Hobbies",
    "het team":                    "Sports & Hobbies",
    "winnen":                      "Sports & Hobbies",
    "verliezen":                   "Sports & Hobbies",
    "Wat is je favoriete sport?":  "Sports & Hobbies",
    "Wat kun je goed?":            "Sports & Hobbies",
    "houden van":                  "Sports & Hobbies",

    # ── Describing Things ────────────────────────────────────────────────────
    "groot":                       "Describing Things",
    "lang":                        "Describing Things",
    "kort":                        "Describing Things",
    "moeilijk":                    "Describing Things",
    "makkelijk":                   "Describing Things",
    "interessant":                 "Describing Things",
    "saai":                        "Describing Things",
    "stom":                        "Describing Things",
    "mooi":                        "Describing Things",
    "een beetje":                  "Describing Things",

    # ── Language & Communication ─────────────────────────────────────────────
    "spreken":                     "Language & Communication",
    "Ik begrijp het niet.":        "Language & Communication",
    "Kun je wat langzamer spreken?": "Language & Communication",
    "Kunt u mij helpen?":          "Language & Communication",
    "Welke talen spreek jij?":     "Language & Communication",
    "Ik spreek Frans en Nederlands.": "Language & Communication",
    "Ik spreek geen...":           "Language & Communication",
    "Spreekt zij Duits?":          "Language & Communication",
    "Spreken jullie Frans?":       "Language & Communication",
    "Ik versta u prima!":          "Language & Communication",
    "U kunt gewoon Nederlands praten, hoor!": "Language & Communication",
    "Hoe heet je?":                "Language & Communication",
    "Waar werk jij?":              "Language & Communication",
    "Waar woon jij?":              "Language & Communication",
    "Wat doe jij?":                "Language & Communication",
    "Ik ben leraar.":              "Language & Communication",
    "Waarom?":                     "Language & Communication",
    "Wat?":                        "Language & Communication",
    "Wanneer ben je jarig?":       "Language & Communication",
    "Hoe oud ben jij?":            "Language & Communication",
    "Wil je...?":                  "Language & Communication",

    # ── Weather & Seasons ────────────────────────────────────────────────────
    "de lente":                    "Weather & Seasons",
    "de zomer":                    "Weather & Seasons",
    "de herfst":                   "Weather & Seasons",
    "de winter":                   "Weather & Seasons",
    "het seizoen":                 "Weather & Seasons",
    "regenen":                     "Weather & Seasons",
    "waaien":                      "Weather & Seasons",
    "koud":                        "Weather & Seasons",
    "droog":                       "Weather & Seasons",

    # ── Celebrations ─────────────────────────────────────────────────────────
    "de verjaardag":               "Celebrations",
    "jarig":                       "Celebrations",
    "Ben je jarig?":               "Celebrations",
    "de taart":                    "Celebrations",
    "het cadeau":                  "Celebrations",
    "de uitnodiging":              "Celebrations",
    "trakteren":                   "Celebrations",
    "vieren":                      "Celebrations",
    "het feest":                   "Celebrations",
    "Gelukkige verjaardag!":       "Celebrations",
    "Kun je naar mijn feestje komen?": "Celebrations",

    # ── Hotel & Accommodation ────────────────────────────────────────────────
    "het hotel":                   "Hotel & Accommodation",
    "de kamer":                    "Hotel & Accommodation",
    "de eenpersoonskamer":         "Hotel & Accommodation",
    "de tweepersoonskamer":        "Hotel & Accommodation",
    "de receptie":                 "Hotel & Accommodation",
    "inchecken":                   "Hotel & Accommodation",
    "uitchecken":                  "Hotel & Accommodation",

    # ── Grammar / Connectors (small functional words) ────────────────────────
    "en":                          "Describing Things",
    "maar":                        "Describing Things",
    "of":                          "Describing Things",
    "want":                        "Describing Things",
    "voor":                        "Describing Things",
    "na":                          "Describing Things",
    "zijn":                        "Describing Things",
    "zullen":                      "Describing Things",
}
# fmt: on


def categorize(dutch: str, csv_category: str = "") -> str:
    """Return the best category for a Dutch word.

    Priority:
    1. If *csv_category* is provided and is not empty / "General" → use it.
    2. Look up *dutch* in CATEGORY_MAP.
    3. Fall back to "General".
    """
    if csv_category and csv_category != "General":
        return csv_category
    return CATEGORY_MAP.get(dutch, "General")


def categorize_batch_llm(words: list[dict[str, str]]) -> dict[str, str]:
    """Use Qwen to categorize words that weren't found in CATEGORY_MAP.

    Args:
        words: list of {"dutch": ..., "english": ...} dicts to classify.

    Returns:
        dict mapping dutch word → category string.
    """
    if not words:
        return {}

    from backend.core.qwen import _get_client, FAST_MODEL

    cat_list = ", ".join(CATEGORIES[1:])  # exclude "General" from prompt
    word_lines = "\n".join(
        f'- "{w["dutch"]}" ({w["english"]})' for w in words
    )

    prompt = (
        f"Classify each Dutch word/phrase into exactly ONE of these categories:\n"
        f"{cat_list}\n\n"
        f"Words:\n{word_lines}\n\n"
        f'Return ONLY a JSON object mapping each Dutch word to its category. '
        f'Example: {{"de trein": "Transport & Travel", "koffie": "Food & Drink"}}\n'
        f"If none of the categories fit, use \"General\"."
    )

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=FAST_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        result = json.loads(raw)
        # Validate: only keep values that are valid categories
        valid = set(CATEGORIES)
        return {k: v for k, v in result.items() if v in valid}
    except Exception as e:
        logger.warning("LLM categorization failed: %s", e)
        return {}
