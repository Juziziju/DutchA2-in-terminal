"""Speaking exam scene content bank — hardcoded for MVP (3 scenes)."""

SCENE_CATEGORIES = ["self_intro", "daily_routine", "shopping"]

SPEAKING_SCENES: dict = {
    "self_intro": {
        "id": "self_intro",
        "title_en": "Self Introduction",
        "title_nl": "Jezelf voorstellen",
        "order": 0,
        "vocab": [
            {"dutch": "Ik heet...", "english": "My name is...", "example": "Ik heet Maria."},
            {"dutch": "Ik kom uit...", "english": "I come from...", "example": "Ik kom uit Turkije."},
            {"dutch": "Ik woon in...", "english": "I live in...", "example": "Ik woon in Amsterdam."},
            {"dutch": "Ik ben ... jaar oud", "english": "I am ... years old", "example": "Ik ben dertig jaar oud."},
            {"dutch": "Ik werk als...", "english": "I work as...", "example": "Ik werk als kok."},
            {"dutch": "Ik ben getrouwd", "english": "I am married", "example": "Ik ben getrouwd en heb twee kinderen."},
            {"dutch": "Mijn hobby is...", "english": "My hobby is...", "example": "Mijn hobby is voetbal."},
            {"dutch": "Ik spreek...", "english": "I speak...", "example": "Ik spreek een beetje Nederlands."},
            {"dutch": "Ik leer Nederlands", "english": "I am learning Dutch", "example": "Ik leer Nederlands op school."},
            {"dutch": "Ik vind ... leuk", "english": "I like ...", "example": "Ik vind koken leuk."},
            {"dutch": "getrouwd", "english": "married", "example": "Bent u getrouwd?"},
            {"dutch": "kinderen", "english": "children", "example": "Ik heb twee kinderen."},
        ],
        "model_sentences": [
            {"text": "Hallo, ik heet Maria en ik kom uit Turkije.", "english": "Hello, my name is Maria and I come from Turkey."},
            {"text": "Ik woon in Amsterdam met mijn man en twee kinderen.", "english": "I live in Amsterdam with my husband and two children."},
            {"text": "Ik ben dertig jaar oud en ik werk als schoonmaakster.", "english": "I am thirty years old and I work as a cleaner."},
            {"text": "In mijn vrije tijd vind ik koken en wandelen leuk.", "english": "In my free time I like cooking and walking."},
            {"text": "Ik leer Nederlands omdat ik in Nederland woon.", "english": "I am learning Dutch because I live in the Netherlands."},
            {"text": "Ik spreek ook een beetje Engels.", "english": "I also speak a little English."},
        ],
        "exam_questions": {
            "short": [
                {
                    "id": "si_s1",
                    "prompt_nl": "Hoe heet u?",
                    "prompt_en": "What is your name?",
                    "prep_seconds": 15,
                    "record_seconds": 30,
                    "expected_phrases": ["ik heet", "mijn naam is"],
                    "model_answer": "Ik heet Maria. Mijn achternaam is de Vries.",
                },
                {
                    "id": "si_s2",
                    "prompt_nl": "Waar komt u vandaan?",
                    "prompt_en": "Where do you come from?",
                    "prep_seconds": 15,
                    "record_seconds": 30,
                    "expected_phrases": ["ik kom uit", "ik kom van"],
                    "model_answer": "Ik kom uit Turkije. Ik woon nu drie jaar in Nederland.",
                },
                {
                    "id": "si_s3",
                    "prompt_nl": "Wat is uw hobby?",
                    "prompt_en": "What is your hobby?",
                    "prep_seconds": 15,
                    "record_seconds": 30,
                    "expected_phrases": ["mijn hobby", "ik vind", "leuk", "vrije tijd"],
                    "model_answer": "Mijn hobby is voetbal. Ik vind ook koken leuk.",
                },
            ],
            "long": [
                {
                    "id": "si_l1",
                    "prompt_nl": "Vertel iets over uzelf. Wie bent u, waar woont u, wat doet u?",
                    "prompt_en": "Tell something about yourself. Who are you, where do you live, what do you do?",
                    "prep_seconds": 30,
                    "record_seconds": 60,
                    "expected_phrases": ["ik heet", "ik woon", "ik werk", "ik kom uit"],
                    "model_answer": "Hallo, ik heet Maria en ik kom uit Turkije. Ik woon in Amsterdam met mijn man en twee kinderen. Ik ben dertig jaar oud. Ik werk als schoonmaakster in een hotel. In mijn vrije tijd vind ik koken en wandelen leuk.",
                },
                {
                    "id": "si_l2",
                    "prompt_nl": "U bent op een feestje. Stel uzelf voor aan iemand die u niet kent. Vertel over uw familie en wat u doet.",
                    "prompt_en": "You are at a party. Introduce yourself to someone you don't know. Talk about your family and what you do.",
                    "prep_seconds": 30,
                    "record_seconds": 60,
                    "expected_phrases": ["ik heet", "ik ben", "kinderen", "getrouwd", "ik werk"],
                    "model_answer": "Hallo, aangenaam. Ik heet Maria. Ik ben getrouwd en ik heb twee kinderen. Mijn man heet Ahmed. Ik werk als schoonmaakster. En u? Wat doet u?",
                },
            ],
        },
    },
    "daily_routine": {
        "id": "daily_routine",
        "title_en": "Daily Routine",
        "title_nl": "Dagelijkse routine",
        "order": 1,
        "vocab": [
            {"dutch": "opstaan", "english": "to get up", "example": "Ik sta om zeven uur op."},
            {"dutch": "ontbijten", "english": "to have breakfast", "example": "Ik ontbijt om half acht."},
            {"dutch": "naar school gaan", "english": "to go to school", "example": "Mijn kinderen gaan om acht uur naar school."},
            {"dutch": "werken", "english": "to work", "example": "Ik werk van negen tot vijf."},
            {"dutch": "koken", "english": "to cook", "example": "Ik kook elke avond."},
            {"dutch": "boodschappen doen", "english": "to do groceries", "example": "Op zaterdag doe ik boodschappen."},
            {"dutch": "schoonmaken", "english": "to clean", "example": "Ik maak het huis schoon."},
            {"dutch": "'s ochtends", "english": "in the morning", "example": "'s Ochtends drink ik koffie."},
            {"dutch": "'s middags", "english": "in the afternoon", "example": "'s Middags werk ik."},
            {"dutch": "'s avonds", "english": "in the evening", "example": "'s Avonds kijk ik televisie."},
            {"dutch": "weekend", "english": "weekend", "example": "In het weekend slaap ik langer."},
            {"dutch": "slapen", "english": "to sleep", "example": "Ik slaap om elf uur."},
        ],
        "model_sentences": [
            {"text": "Ik sta elke dag om zeven uur op.", "english": "I get up at seven o'clock every day."},
            {"text": "'s Ochtends breng ik mijn kinderen naar school.", "english": "In the morning I take my children to school."},
            {"text": "Ik werk van negen tot vijf op kantoor.", "english": "I work from nine to five at the office."},
            {"text": "'s Avonds kook ik voor mijn gezin.", "english": "In the evening I cook for my family."},
            {"text": "In het weekend doe ik boodschappen en maak ik het huis schoon.", "english": "On the weekend I do groceries and clean the house."},
            {"text": "Na het eten kijk ik televisie of lees ik een boek.", "english": "After dinner I watch TV or read a book."},
        ],
        "exam_questions": {
            "short": [
                {
                    "id": "dr_s1",
                    "prompt_nl": "Hoe laat staat u op?",
                    "prompt_en": "What time do you get up?",
                    "prep_seconds": 15,
                    "record_seconds": 30,
                    "expected_phrases": ["ik sta op", "uur", "om"],
                    "model_answer": "Ik sta om zeven uur op. Dan douche ik en ontbijt ik.",
                },
                {
                    "id": "dr_s2",
                    "prompt_nl": "Wat doet u 's avonds?",
                    "prompt_en": "What do you do in the evening?",
                    "prep_seconds": 15,
                    "record_seconds": 30,
                    "expected_phrases": ["'s avonds", "koken", "televisie", "eten"],
                    "model_answer": "'s Avonds kook ik en eet ik met mijn gezin. Daarna kijk ik televisie.",
                },
                {
                    "id": "dr_s3",
                    "prompt_nl": "Wat doet u in het weekend?",
                    "prompt_en": "What do you do on the weekend?",
                    "prep_seconds": 15,
                    "record_seconds": 30,
                    "expected_phrases": ["weekend", "boodschappen", "schoonmaken", "vrije tijd"],
                    "model_answer": "In het weekend slaap ik langer. Dan doe ik boodschappen en maak ik het huis schoon.",
                },
            ],
            "long": [
                {
                    "id": "dr_l1",
                    "prompt_nl": "Vertel over een gewone dag. Wat doet u 's ochtends, 's middags en 's avonds?",
                    "prompt_en": "Tell about a normal day. What do you do in the morning, afternoon and evening?",
                    "prep_seconds": 30,
                    "record_seconds": 60,
                    "expected_phrases": ["'s ochtends", "'s middags", "'s avonds", "opstaan", "werken", "koken"],
                    "model_answer": "'s Ochtends sta ik om zeven uur op. Ik ontbijt en breng mijn kinderen naar school. 's Middags werk ik op kantoor. 's Avonds kook ik voor mijn gezin. Na het eten kijk ik televisie en om elf uur ga ik slapen.",
                },
                {
                    "id": "dr_l2",
                    "prompt_nl": "Uw vriend vraagt wat u gisteren hebt gedaan. Vertel over uw dag van gisteren.",
                    "prompt_en": "Your friend asks what you did yesterday. Tell about your day yesterday.",
                    "prep_seconds": 30,
                    "record_seconds": 60,
                    "expected_phrases": ["gisteren", "heb", "ben", "gegaan", "gedaan"],
                    "model_answer": "Gisteren ben ik om zes uur opgestaan. Ik heb ontbeten en ben naar mijn werk gegaan. 's Middags heb ik geluncht met een collega. 's Avonds heb ik gekookt en heb ik met mijn kinderen gespeeld.",
                },
            ],
        },
    },
    "shopping": {
        "id": "shopping",
        "title_en": "Shopping",
        "title_nl": "Winkelen",
        "order": 2,
        "vocab": [
            {"dutch": "Hoeveel kost het?", "english": "How much does it cost?", "example": "Hoeveel kost deze jas?"},
            {"dutch": "Mag ik ... ?", "english": "May I ... ?", "example": "Mag ik dit passen?"},
            {"dutch": "te duur", "english": "too expensive", "example": "Dit is te duur voor mij."},
            {"dutch": "korting", "english": "discount", "example": "Is er korting op deze schoenen?"},
            {"dutch": "pinnen", "english": "to pay by card", "example": "Kan ik pinnen?"},
            {"dutch": "contant", "english": "cash", "example": "Ik betaal contant."},
            {"dutch": "de maat", "english": "the size", "example": "Welke maat hebt u nodig?"},
            {"dutch": "passen", "english": "to try on / to fit", "example": "Mag ik deze broek passen?"},
            {"dutch": "het bonnetje", "english": "the receipt", "example": "Mag ik het bonnetje?"},
            {"dutch": "ruilen", "english": "to exchange", "example": "Kan ik dit ruilen?"},
            {"dutch": "de winkel", "english": "the shop", "example": "De winkel is om negen uur open."},
            {"dutch": "de kassa", "english": "the checkout", "example": "U kunt betalen bij de kassa."},
        ],
        "model_sentences": [
            {"text": "Goedemiddag, ik zoek een winterjas.", "english": "Good afternoon, I am looking for a winter jacket."},
            {"text": "Hoeveel kost deze jas?", "english": "How much does this jacket cost?"},
            {"text": "Heeft u deze ook in maat M?", "english": "Do you also have this in size M?"},
            {"text": "Mag ik deze broek passen?", "english": "May I try on these trousers?"},
            {"text": "Kan ik met pin betalen?", "english": "Can I pay by card?"},
            {"text": "Ik wil dit graag ruilen, het is te klein.", "english": "I would like to exchange this, it is too small."},
        ],
        "exam_questions": {
            "short": [
                {
                    "id": "sh_s1",
                    "prompt_nl": "U bent in een kledingwinkel. U wilt een broek passen. Wat zegt u?",
                    "prompt_en": "You are in a clothing store. You want to try on trousers. What do you say?",
                    "prep_seconds": 15,
                    "record_seconds": 30,
                    "expected_phrases": ["mag ik", "passen", "broek"],
                    "model_answer": "Goedemiddag. Mag ik deze broek passen? Waar is de paskamer?",
                },
                {
                    "id": "sh_s2",
                    "prompt_nl": "U wilt weten hoeveel iets kost. Wat vraagt u?",
                    "prompt_en": "You want to know how much something costs. What do you ask?",
                    "prep_seconds": 15,
                    "record_seconds": 30,
                    "expected_phrases": ["hoeveel", "kost", "prijs"],
                    "model_answer": "Pardon, hoeveel kost dit? Is er korting?",
                },
                {
                    "id": "sh_s3",
                    "prompt_nl": "U wilt iets ruilen. Het is te klein. Wat zegt u?",
                    "prompt_en": "You want to exchange something. It is too small. What do you say?",
                    "prep_seconds": 15,
                    "record_seconds": 30,
                    "expected_phrases": ["ruilen", "te klein", "maat"],
                    "model_answer": "Goedemiddag, ik wil dit graag ruilen. Het is te klein. Heeft u een grotere maat?",
                },
            ],
            "long": [
                {
                    "id": "sh_l1",
                    "prompt_nl": "U bent in een winkel. U zoekt een cadeau voor uw vriend. Vertel de verkoper wat u zoekt en stel vragen over de prijs en maat.",
                    "prompt_en": "You are in a shop. You are looking for a gift for your friend. Tell the salesperson what you are looking for and ask about price and size.",
                    "prep_seconds": 30,
                    "record_seconds": 60,
                    "expected_phrases": ["ik zoek", "cadeau", "hoeveel kost", "maat", "vriend"],
                    "model_answer": "Goedemiddag. Ik zoek een cadeau voor mijn vriend. Hij houdt van sport. Heeft u sportschoenen? Welke maten hebt u? Hoeveel kosten ze? Kan ik met pin betalen?",
                },
                {
                    "id": "sh_l2",
                    "prompt_nl": "U hebt gisteren iets gekocht maar het is kapot. U gaat terug naar de winkel. Wat zegt u tegen de verkoper?",
                    "prompt_en": "You bought something yesterday but it is broken. You go back to the shop. What do you say to the salesperson?",
                    "prep_seconds": 30,
                    "record_seconds": 60,
                    "expected_phrases": ["gisteren", "gekocht", "kapot", "ruilen", "bonnetje", "geld terug"],
                    "model_answer": "Goedemiddag. Ik heb gisteren deze lamp gekocht maar hij is kapot. Hier is het bonnetje. Kan ik het ruilen of kan ik mijn geld terug krijgen?",
                },
            ],
        },
    },
}


def get_scene_list() -> list[dict]:
    """Return a list of scene summaries (no questions)."""
    scenes = []
    for scene_id in SCENE_CATEGORIES:
        s = SPEAKING_SCENES[scene_id]
        scenes.append({
            "id": s["id"],
            "title_en": s["title_en"],
            "title_nl": s["title_nl"],
            "order": s["order"],
            "vocab_count": len(s["vocab"]),
            "sentence_count": len(s["model_sentences"]),
            "question_count": sum(
                len(s["exam_questions"][t]) for t in ("short", "long")
            ),
        })
    return scenes


def get_scene(scene_id: str) -> dict | None:
    return SPEAKING_SCENES.get(scene_id)


def get_question(scene_id: str, question_id: str) -> dict | None:
    scene = SPEAKING_SCENES.get(scene_id)
    if not scene:
        return None
    for qtype in ("short", "long"):
        for q in scene["exam_questions"][qtype]:
            if q["id"] == question_id:
                return {**q, "question_type": qtype}
    return None
