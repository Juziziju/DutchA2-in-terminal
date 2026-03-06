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



# ── Mock exam bank — real inburgering A2 speaking exam questions ─────────────
# Sources: DUO oefenexamens, Dik Verhaar spreekoefeningen, Uilentaal, NT2 TaalMenu
# Format after March 2025: recording-only (no multiple choice), ~24 questions in 35 min
# Short = 15s prep → 30s record; Long = 30s prep → 60s record

MOCK_EXAM_SETS: list[dict] = [
    # ── Mock Exam 1 ──────────────────────────────────────────────────────────
    {
        "id": "mock_1",
        "title": "Practice Exam 1",
        "short": [
            {
                "id": "m1_s01",
                "prompt_nl": "Eet u vaak brood? Vertel ook waarom.",
                "prompt_en": "Do you often eat bread? Also tell why.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["brood", "eet", "omdat", "lekker", "ontbijt"],
                "model_answer": "Ja, ik eet elke dag brood. Ik eet brood bij het ontbijt omdat het lekker en goedkoop is.",
            },
            {
                "id": "m1_s02",
                "prompt_nl": "Naar welke muziek luistert u graag?",
                "prompt_en": "What music do you enjoy listening to?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["luister", "muziek", "graag", "leuk"],
                "model_answer": "Ik luister graag naar popmuziek. Ik luister het bijna elke dag.",
            },
            {
                "id": "m1_s03",
                "prompt_nl": "Hebt u een rijbewijs?",
                "prompt_en": "Do you have a driver's license?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["rijbewijs", "ja", "nee", "auto"],
                "model_answer": "Nee, ik heb geen rijbewijs. Ik reis meestal met de bus of de fiets.",
            },
            {
                "id": "m1_s04",
                "prompt_nl": "Wat voor groente eet u vaak? Vertel ook waarom.",
                "prompt_en": "What vegetables do you eat often? Also tell why.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["groente", "eet", "gezond", "lekker"],
                "model_answer": "Ik eet vaak tomaten en paprika. Ik vind groente gezond en lekker.",
            },
            {
                "id": "m1_s05",
                "prompt_nl": "Hoe vaak gebruikt u een computer? Vertel ook waarvoor u de computer gebruikt.",
                "prompt_en": "How often do you use a computer? Also tell what you use the computer for.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["computer", "gebruik", "elke dag", "internet", "werken"],
                "model_answer": "Ik gebruik elke dag een computer. Ik gebruik de computer voor mijn werk en om op internet te kijken.",
            },
            {
                "id": "m1_s06",
                "prompt_nl": "Reist u liever met de trein of de auto? Vertel ook waarom.",
                "prompt_en": "Do you prefer to travel by train or car? Also tell why.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["trein", "auto", "liever", "omdat", "snel", "makkelijk"],
                "model_answer": "Ik reis liever met de trein omdat het makkelijk is. Je hoeft niet te parkeren.",
            },
            {
                "id": "m1_s07",
                "prompt_nl": "Wat vindt u van het weer in Nederland? Vertel ook hoe het weer in uw eigen land is.",
                "prompt_en": "What do you think of the weather in the Netherlands? Also tell how the weather in your own country is.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["weer", "koud", "regen", "eigen land", "warm", "zon"],
                "model_answer": "Het weer in Nederland vind ik koud en nat. In mijn eigen land is het weer warm en zonnig.",
            },
            {
                "id": "m1_s08",
                "prompt_nl": "Wat vindt u van wandelen?",
                "prompt_en": "What do you think about walking?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["wandelen", "leuk", "gezond", "buiten"],
                "model_answer": "Ik vind wandelen leuk omdat het gezond is. Ik wandel graag in het park.",
            },
        ],
        "long": [
            {
                "id": "m1_l01",
                "prompt_nl": "Wat doet u het liefst in het weekend? Vertel ook wat u niet graag doet in het weekend.",
                "prompt_en": "What do you prefer to do on the weekend? Also tell what you don't like to do on the weekend.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["weekend", "liefst", "graag", "niet leuk", "vrije tijd"],
                "model_answer": "In het weekend slaap ik graag lang. Dan doe ik boodschappen en ga ik wandelen in het park. Ik vind schoonmaken niet leuk, maar dat moet ik ook in het weekend doen. 's Avonds kook ik lekker eten.",
            },
            {
                "id": "m1_l02",
                "prompt_nl": "Wat voor eten eet u het liefst? Vertel ook waarom.",
                "prompt_en": "What food do you like most? Also tell why.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["eten", "liefst", "lekker", "koken", "omdat"],
                "model_answer": "Ik eet het liefst rijst met kip en groente. Ik vind dat lekker omdat mijn moeder dat ook altijd kookte. Ik kook het zelf ook vaak. Soms eet ik ook graag pizza.",
            },
            {
                "id": "m1_l03",
                "prompt_nl": "Wat vindt u leuk om te koken? Vertel ook hoe u dat maakt.",
                "prompt_en": "What do you like to cook? Also tell how you make it.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["koken", "leuk", "maak", "eerst", "dan", "nodig"],
                "model_answer": "Ik vind het leuk om soep te koken. Ik heb groente, water en kruiden nodig. Eerst snijd ik de groente. Dan doe ik alles in een pan met water. Het moet een half uur koken.",
            },
            {
                "id": "m1_l04",
                "prompt_nl": "Veel Nederlanders eten om zes uur 's avonds. Wat vindt u daarvan? Zeg ook hoe laat u zelf meestal eet.",
                "prompt_en": "Many Dutch people eat at 6 PM. What do you think about that? Also say what time you usually eat.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["eten", "uur", "vind", "zelf", "meestal", "avond"],
                "model_answer": "Ik vind dat vroeg. In mijn eigen land eten we om acht uur. Maar nu in Nederland eet ik ook om zes uur, omdat mijn kinderen dan honger hebben. Ik ben er nu aan gewend.",
            },
            {
                "id": "m1_l05",
                "prompt_nl": "Welke dingen vindt u leuk in Nederland? Vertel ook welke dingen u leuk vindt in uw eigen land.",
                "prompt_en": "What things do you like about the Netherlands? Also tell what things you like about your own country.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["Nederland", "leuk", "eigen land", "vind"],
                "model_answer": "In Nederland vind ik de fietspaden leuk. Het is ook veilig en schoon. In mijn eigen land vind ik het eten lekker en de mensen zijn heel gastvrij. Ik mis het warme weer.",
            },
            {
                "id": "m1_l06",
                "prompt_nl": "Wat doet u graag in uw vrije tijd? Vertel ook hoe vaak u dat doet.",
                "prompt_en": "What do you like to do in your free time? Also tell how often you do it.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["vrije tijd", "graag", "hoe vaak", "keer per week"],
                "model_answer": "In mijn vrije tijd ga ik graag wandelen en koken. Ik wandel twee keer per week in het park. Ik kook elke avond. Soms lees ik ook een boek.",
            },
            {
                "id": "m1_l07",
                "prompt_nl": "Wat voor werk doet u nu? Vertel ook wat voor werk u vroeger hebt gedaan.",
                "prompt_en": "What work do you do now? Also tell what kind of work you did before.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["werk", "nu", "vroeger", "gedaan", "gewerkt"],
                "model_answer": "Nu werk ik als schoonmaker in een hotel. Ik werk daar drie dagen per week. Vroeger heb ik als kok gewerkt in mijn eigen land. Dat vond ik leuk werk.",
            },
            {
                "id": "m1_l08",
                "prompt_nl": "Wat voor hobby's heeft u nu? Vertel ook wat voor hobby's u vroeger had.",
                "prompt_en": "What hobbies do you have now? Also tell what hobbies you had before.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["hobby", "nu", "vroeger", "had", "leuk"],
                "model_answer": "Nu is mijn hobby wandelen en koken. Ik vind dat leuk en ontspannend. Vroeger had ik andere hobby's. Ik speelde veel voetbal met mijn vrienden. Dat kan hier ook, maar ik heb minder tijd.",
            },
        ],
    },
    # ── Mock Exam 2 ──────────────────────────────────────────────────────────
    {
        "id": "mock_2",
        "title": "Practice Exam 2",
        "short": [
            {
                "id": "m2_s01",
                "prompt_nl": "Waar doet u meestal boodschappen? Vertel ook waarom.",
                "prompt_en": "Where do you usually do groceries? Also tell why.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["boodschappen", "supermarkt", "omdat", "dichtbij"],
                "model_answer": "Ik doe meestal boodschappen bij de Albert Heijn. Die is dichtbij mijn huis.",
            },
            {
                "id": "m2_s02",
                "prompt_nl": "Wat vindt u een leuk programma op de televisie? Vertel ook hoe vaak u televisie kijkt.",
                "prompt_en": "What TV show do you like? Also tell how often you watch TV.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["televisie", "programma", "kijk", "leuk", "vaak"],
                "model_answer": "Ik vind het journaal een leuk programma. Ik kijk elke avond televisie, ongeveer een uur.",
            },
            {
                "id": "m2_s03",
                "prompt_nl": "Gaat u vaak met de fiets? Vertel ook waarvoor u de fiets gebruikt.",
                "prompt_en": "Do you often cycle? Also tell what you use the bicycle for.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["fiets", "ga", "naar", "werk", "school", "boodschappen"],
                "model_answer": "Ja, ik ga vaak met de fiets. Ik gebruik de fiets om naar school te gaan en om boodschappen te doen.",
            },
            {
                "id": "m2_s04",
                "prompt_nl": "Welk cadeau krijgt u het liefst als u jarig bent? Vertel ook waarom.",
                "prompt_en": "What gift do you like best for your birthday? Also tell why.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["cadeau", "verjaardag", "liefst", "krijg", "omdat"],
                "model_answer": "Ik krijg het liefst kleren als cadeau, omdat ik van mooie kleren houd.",
            },
            {
                "id": "m2_s05",
                "prompt_nl": "Wat eet u graag? Vertel ook wat u niet graag eet.",
                "prompt_en": "What do you like to eat? Also tell what you don't like to eat.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["eet", "graag", "niet graag", "lekker"],
                "model_answer": "Ik eet graag rijst met kip. Ik eet niet graag vis, want ik vind de smaak niet lekker.",
            },
            {
                "id": "m2_s06",
                "prompt_nl": "Welk fruit eet u het liefst? Vertel ook hoe vaak u groente eet.",
                "prompt_en": "What fruit do you like most? Also tell how often you eat vegetables.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["fruit", "liefst", "groente", "elke dag", "vaak"],
                "model_answer": "Ik eet het liefst appels en bananen. Ik eet elke dag groente bij het avondeten.",
            },
            {
                "id": "m2_s07",
                "prompt_nl": "In Nederland hebben veel mensen een hond. Wat vindt u daarvan?",
                "prompt_en": "Many people in the Netherlands have a dog. What do you think about that?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["hond", "vind", "leuk", "dieren"],
                "model_answer": "Ik vind het leuk dat mensen een hond hebben. Maar ik heb zelf geen hond, want mijn huis is te klein.",
            },
            {
                "id": "m2_s08",
                "prompt_nl": "Wat doet u het liefst als het mooi weer is?",
                "prompt_en": "What do you prefer to do when the weather is nice?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["mooi weer", "buiten", "wandelen", "park", "fiets"],
                "model_answer": "Als het mooi weer is ga ik graag naar het park. Ik wandel daar of fiets met mijn kinderen.",
            },
        ],
        "long": [
            {
                "id": "m2_l01",
                "prompt_nl": "Hoe vaak gebruikt u uw computer? Vertel ook waarvoor u uw computer gebruikt.",
                "prompt_en": "How often do you use your computer? Also tell what you use your computer for.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["computer", "gebruik", "elke dag", "internet", "mail", "werk"],
                "model_answer": "Ik gebruik mijn computer elke dag. Ik gebruik hem voor mijn werk en om e-mails te sturen. Ik kijk ook op internet naar het nieuws. Soms kijk ik ook filmpjes op YouTube.",
            },
            {
                "id": "m2_l02",
                "prompt_nl": "Wat vindt u leuk om te lezen? Vertel ook wat u niet leuk vindt om te lezen.",
                "prompt_en": "What do you like to read? Also tell what you don't like to read.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["lezen", "leuk", "niet leuk", "boek", "krant"],
                "model_answer": "Ik vind het leuk om de krant te lezen. Ik lees ook graag korte verhalen. Ik vind het niet leuk om dikke boeken te lezen, want dat duurt te lang.",
            },
            {
                "id": "m2_l03",
                "prompt_nl": "Wat vindt u van het eten in Nederland? Vertel ook hoe het eten in uw eigen land is.",
                "prompt_en": "What do you think of the food in the Netherlands? Also tell how the food in your own country is.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["eten", "Nederland", "eigen land", "lekker", "anders"],
                "model_answer": "Het eten in Nederland is anders dan in mijn eigen land. Ik vind stamppot niet zo lekker. In mijn eigen land is het eten meer gekruid. Ik kook thuis vaak eten uit mijn eigen land.",
            },
            {
                "id": "m2_l04",
                "prompt_nl": "Ik was vandaag te laat op een afspraak. Waardoor bent u weleens te laat? Zeg ook wat u dan doet.",
                "prompt_en": "I was late for an appointment today. Why are you sometimes late? Also say what you do then.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["te laat", "bus", "trein", "bellen", "sorry", "vertraging"],
                "model_answer": "Ik ben weleens te laat als de bus vertraging heeft. Dan bel ik om te zeggen dat ik later kom. Ik zeg sorry als ik aankom. Ik probeer altijd op tijd te zijn.",
            },
            {
                "id": "m2_l05",
                "prompt_nl": "In Nederland sneeuwt het soms. Wat vindt u daarvan? Vertel ook wat u dan doet.",
                "prompt_en": "It sometimes snows in the Netherlands. What do you think about that? Also tell what you do then.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["sneeuw", "koud", "mooi", "binnen", "warm"],
                "model_answer": "Ik vind sneeuw heel mooi, maar ook erg koud. In mijn eigen land sneeuwt het niet. Als het sneeuwt, blijf ik het liefst binnen. Ik drink dan warme thee en kijk naar buiten.",
            },
            {
                "id": "m2_l06",
                "prompt_nl": "Ik wil graag goed Engels leren spreken. Wat wilt u graag leren? Vertel ook waar u dat kunt leren.",
                "prompt_en": "I would like to learn to speak English well. What would you like to learn? Also tell where you can learn that.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["leren", "wil", "graag", "school", "cursus", "waar"],
                "model_answer": "Ik wil graag goed Nederlands leren spreken. Ik kan dat leren op de taalschool. Ik volg nu een cursus twee keer per week. Ik oefen ook thuis met mijn buurvrouw.",
            },
            {
                "id": "m2_l07",
                "prompt_nl": "Waar gaat u het liefst winkelen? Vertel ook wat u vaak koopt als u gaat winkelen.",
                "prompt_en": "Where do you prefer to go shopping? Also tell what you often buy when you go shopping.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["winkelen", "koop", "vaak", "kleren", "markt", "winkel"],
                "model_answer": "Ik ga het liefst winkelen op de markt. Daar koop ik groente en fruit. Soms ga ik ook naar de Primark voor kleren. Die winkel is goedkoop.",
            },
            {
                "id": "m2_l08",
                "prompt_nl": "Wat doet u het liefst 's avonds? Zeg ook waar u dat het liefst doet.",
                "prompt_en": "What do you prefer to do in the evening? Also say where you prefer to do that.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["'s avonds", "liefst", "thuis", "televisie", "koken"],
                "model_answer": "s Avonds kook ik graag voor mijn gezin. Na het eten kijk ik televisie in de woonkamer. Soms lees ik een boek in bed. Ik doe dat het liefst thuis.",
            },
        ],
    },
    # ── Mock Exam 3 ──────────────────────────────────────────────────────────
    {
        "id": "mock_3",
        "title": "Practice Exam 3",
        "short": [
            {
                "id": "m3_s01",
                "prompt_nl": "Wat vindt u gezond?",
                "prompt_en": "What do you consider healthy?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["gezond", "sporten", "groente", "fruit"],
                "model_answer": "Ik vind het gezond om te sporten. Groente en fruit eten vind ik ook gezond. Zoet en vet eten vind ik niet gezond.",
            },
            {
                "id": "m3_s02",
                "prompt_nl": "Wat gaat u morgen doen?",
                "prompt_en": "What will you do tomorrow?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["morgen", "ga", "naar", "werken", "school"],
                "model_answer": "Morgen ga ik naar school om negen uur. 's Middags ga ik boodschappen doen.",
            },
            {
                "id": "m3_s03",
                "prompt_nl": "Wat was er deze week in het nieuws?",
                "prompt_en": "What was in the news this week?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["nieuws", "week", "gelezen", "gehoord"],
                "model_answer": "Deze week was het weer in het nieuws. Het was erg koud. Ik vind dat interessant.",
            },
            {
                "id": "m3_s04",
                "prompt_nl": "Waarvoor gebruikt u uw telefoon vaak?",
                "prompt_en": "What do you use your phone for often?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["telefoon", "bellen", "WhatsApp", "internet"],
                "model_answer": "Ik gebruik mijn telefoon om te bellen en om WhatsApp-berichten te sturen. Ik kijk ook op internet.",
            },
            {
                "id": "m3_s05",
                "prompt_nl": "In Nederland dragen veel mensen op Koningsdag oranje kleren. Wat vindt u daarvan?",
                "prompt_en": "In the Netherlands, many people wear orange on King's Day. What do you think about that?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["Koningsdag", "oranje", "leuk", "feest"],
                "model_answer": "Ik vind dat leuk. Koningsdag is een groot feest in Nederland. Ik heb vorig jaar ook oranje gedragen.",
            },
            {
                "id": "m3_s06",
                "prompt_nl": "Welk dier vindt u niet leuk?",
                "prompt_en": "Which animal don't you like?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["dier", "niet leuk", "bang", "houd niet van"],
                "model_answer": "Ik houd niet van slangen, want ik vind ze eng. Ik ben een beetje bang voor grote honden.",
            },
            {
                "id": "m3_s07",
                "prompt_nl": "Leest u vaak? Vertel ook wat u graag leest.",
                "prompt_en": "Do you read often? Also tell what you like to read.",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["lezen", "lees", "boek", "krant", "telefoon"],
                "model_answer": "Ja, ik lees elke dag. Ik lees graag het nieuws op mijn telefoon. Soms lees ik een Nederlands boek.",
            },
            {
                "id": "m3_s08",
                "prompt_nl": "Wat voor kleren draagt u het liefst?",
                "prompt_en": "What kind of clothes do you prefer to wear?",
                "prep_seconds": 15, "record_seconds": 30,
                "expected_phrases": ["kleren", "draag", "liefst", "comfortabel"],
                "model_answer": "Ik draag het liefst een spijkerbroek en een t-shirt. Dat is comfortabel en makkelijk.",
            },
        ],
        "long": [
            {
                "id": "m3_l01",
                "prompt_nl": "Wat vindt u makkelijk om te koken? Vertel ook wat u daarvoor nodig heeft.",
                "prompt_en": "What do you find easy to cook? Also tell what you need for it.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["koken", "makkelijk", "nodig", "groente", "pan"],
                "model_answer": "Ik vind het makkelijk om pasta te koken. Ik heb pasta, tomatensaus en groente nodig. Eerst kook ik het water. Dan doe ik de pasta erin. In een andere pan maak ik de saus.",
            },
            {
                "id": "m3_l02",
                "prompt_nl": "Gaat u vaak bij familie of vrienden op bezoek? Vertel ook hoe u dat doet.",
                "prompt_en": "Do you often visit family or friends? Also tell how you do that.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["bezoek", "familie", "vrienden", "ga", "bus", "fiets"],
                "model_answer": "Ja, ik ga elke week bij mijn zus op bezoek. Zij woont in dezelfde stad. Ik ga met de fiets. Soms bel ik ook met mijn moeder in mijn eigen land. Dat doe ik via WhatsApp.",
            },
            {
                "id": "m3_l03",
                "prompt_nl": "Waarom kunt u soms niet op een afspraak komen? Vertel ook wat u doet als u niet op een afspraak kunt komen.",
                "prompt_en": "Why can you sometimes not come to an appointment? Also tell what you do if you can't come.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["afspraak", "niet komen", "ziek", "bellen", "afzeggen"],
                "model_answer": "Soms kan ik niet op een afspraak komen als ik ziek ben of als mijn kind ziek is. Dan bel ik om de afspraak af te zeggen. Ik maak een nieuwe afspraak voor een andere dag.",
            },
            {
                "id": "m3_l04",
                "prompt_nl": "Ik houd erg van bloemen. Waar houdt u het meest van? Vertel ook waarom.",
                "prompt_en": "I really love flowers. What do you love most? Also tell why.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["houd van", "meest", "omdat", "leuk", "mooi"],
                "model_answer": "Ik houd het meest van koken. Ik vind het leuk om nieuwe recepten te proberen. Mijn familie vindt mijn eten lekker. Dat maakt mij blij.",
            },
            {
                "id": "m3_l05",
                "prompt_nl": "Welke dingen vindt u niet leuk in Nederland? Vertel ook welke dingen u niet leuk vindt in uw eigen land.",
                "prompt_en": "What things don't you like about the Netherlands? Also tell what things you don't like about your own country.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["niet leuk", "Nederland", "eigen land", "weer", "koud"],
                "model_answer": "In Nederland vind ik het koude weer niet leuk. Het regent veel. In mijn eigen land vind ik het verkeer niet leuk. Er zijn te veel auto's en het is gevaarlijk.",
            },
            {
                "id": "m3_l06",
                "prompt_nl": "Ik krijg het liefst boeken als ik jarig ben. Wat krijgt u graag als cadeau? Vertel ook wat u niet leuk vindt om te krijgen.",
                "prompt_en": "I like getting books for my birthday. What do you like as a gift? Also tell what you don't like to receive.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["cadeau", "jarig", "krijg", "graag", "niet leuk"],
                "model_answer": "Ik krijg graag geld als ik jarig ben. Dan kan ik zelf kiezen wat ik koop. Ik vind het niet leuk om parfum te krijgen, want ik gebruik dat niet.",
            },
            {
                "id": "m3_l07",
                "prompt_nl": "Wat doet u graag als het mooi weer is? Vertel ook met wie u dat doet.",
                "prompt_en": "What do you like to do when the weather is nice? Also tell who you do it with.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["mooi weer", "buiten", "wandelen", "kinderen", "park", "samen"],
                "model_answer": "Als het mooi weer is ga ik graag naar het park met mijn kinderen. We wandelen en spelen daar. Soms gaan we ook naar het strand met de hele familie. Dat vind ik heel leuk.",
            },
            {
                "id": "m3_l08",
                "prompt_nl": "Wat voor werk vindt u leuk om te doen? Vertel ook wat voor werk u niet leuk vindt om te doen.",
                "prompt_en": "What kind of work do you like to do? Also tell what kind of work you don't like to do.",
                "prep_seconds": 30, "record_seconds": 60,
                "expected_phrases": ["werk", "leuk", "niet leuk", "mensen", "kantoor"],
                "model_answer": "Ik vind het leuk om met mensen te werken. Ik wil graag in een winkel werken of in de zorg. Ik vind het niet leuk om de hele dag op kantoor achter een computer te zitten.",
            },
        ],
    },
]


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


def get_mock_exam_list() -> list[dict]:
    """Return mock exam summaries."""
    return [
        {
            "id": e["id"],
            "title": e["title"],
            "short_count": len(e["short"]),
            "long_count": len(e["long"]),
        }
        for e in MOCK_EXAM_SETS
    ]


def get_mock_exam(exam_id: str) -> dict | None:
    for e in MOCK_EXAM_SETS:
        if e["id"] == exam_id:
            return e
    return None


def get_mock_question(exam_id: str, question_id: str) -> dict | None:
    exam = get_mock_exam(exam_id)
    if not exam:
        return None
    for qtype in ("short", "long"):
        for q in exam[qtype]:
            if q["id"] == question_id:
                return {**q, "question_type": qtype}
    return None
