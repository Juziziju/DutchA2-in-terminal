"""Schrijven A2 Oefenexamen data — mirrors the 3 official DUO practice exams.

Each exam has 4 tasks (opgaven), always a mix of:
- 2 emails (e-mail schrijven)
- 1 kort verhaal (short text for wijkkrant)
- 1 formulier (fill in a form)
"""

SCHRIJVEN_EXAMS: list[dict] = [
    # ── Oefenexamen 1 ─────────────────────────────────────────────────────────
    {
        "id": "schrijven_1",
        "title": "Schrijven A2 Oefenexamen 1",
        "tasks": [
            {
                "id": "s1_t1",
                "task_type": "email",
                "title": "Afspraak verzetten",
                "situation_nl": "U volgt een opleiding. U hebt morgen een afspraak met Amber, een andere student. U kunt niet en wilt een andere afspraak maken. U schrijft daarom een e-mail aan Amber.",
                "situation_en": "You are following a course. You have an appointment with Amber, another student, tomorrow. You can't make it and want to reschedule. You write an email to Amber.",
                "recipient": "Amber",
                "bullet_points": [
                    {"nl": "Schrijf dat u de afspraak wilt verzetten.", "en": "Write that you want to reschedule the appointment."},
                    {"nl": "Schrijf waarom u dat wilt. Bedenk zelf waarom.", "en": "Write why you want to. Make up a reason yourself."},
                    {"nl": "Stel een nieuwe datum voor.", "en": "Suggest a new date."},
                ],
                "instructions_nl": "Schrijf de e-mail. Schrijf in hele zinnen.",
                "instructions_en": "Write the email. Write in complete sentences.",
                "model_answer": "Beste Amber,\n\nIk schrijf je omdat ik onze afspraak van morgen wil verzetten. Ik kan helaas niet komen, want ik moet naar de dokter. Kunnen we volgende week dinsdag afspreken? Dan ben ik wel vrij.\n\nMet vriendelijke groet,\n[naam]",
            },
            {
                "id": "s1_t2",
                "task_type": "kort_verhaal",
                "title": "Feest",
                "situation_nl": "U krijgt elke week een wijkkrant. Iedereen uit de buurt mag iets voor deze krant schrijven. U schrijft over een feest dat u elk jaar viert.",
                "situation_en": "You receive a neighbourhood newspaper every week. Everyone in the neighbourhood may write something for it. You write about a celebration you celebrate every year.",
                "guiding_questions": [
                    {"nl": "Waarom viert u het feest?", "en": "Why do you celebrate the party?"},
                    {"nl": "Wie komen er op het feest?", "en": "Who comes to the party?"},
                    {"nl": "Wat doet u op het feest?", "en": "What do you do at the party?"},
                ],
                "instructions_nl": "Schrijf minimaal drie zinnen op. Schrijf in hele zinnen.",
                "instructions_en": "Write at least three sentences. Write in complete sentences.",
                "starter_text": "Dit is mijn tekst over het feest dat ik elk jaar vier:",
                "model_answer": "Elk jaar vieren wij Suikerfeest. Wij vieren het omdat het de laatste dag van de ramadan is. Mijn familie komt dan bij ons. We eten lekker eten en de kinderen krijgen cadeaus. Ik vind het een heel leuk feest.",
            },
            {
                "id": "s1_t3",
                "task_type": "formulier",
                "title": "Inschrijven sportschool",
                "situation_nl": "U wilt graag sporten. U gaat naar een sportschool in uw buurt. U moet een formulier invullen. Sommige gegevens moet u zelf bedenken.",
                "situation_en": "You want to exercise. You go to a gym in your neighbourhood. You have to fill in a form. You have to make up some information yourself.",
                "form_title_nl": "Inschrijfformulier Sportclub SPRINT",
                "form_title_en": "Registration form Sportclub SPRINT",
                "fields": [
                    {"label_nl": "Voor- en achternaam", "label_en": "First and last name", "field_type": "text"},
                    {"label_nl": "Adres", "label_en": "Address", "field_type": "text"},
                    {"label_nl": "Postcode", "label_en": "Postal code", "field_type": "text"},
                    {"label_nl": "Woonplaats", "label_en": "City", "field_type": "text"},
                    {"label_nl": "Telefoonnummer", "label_en": "Phone number", "field_type": "text"},
                    {"label_nl": "Geslacht", "label_en": "Gender", "field_type": "select", "options": ["man", "vrouw"]},
                    {"label_nl": "Geboortedatum", "label_en": "Date of birth", "field_type": "text", "placeholder": "dd-mm-jjjj"},
                    {"label_nl": "Welke groepsles wilt u nu gaan doen?", "label_en": "Which group class do you want to take?", "field_type": "select", "options": ["Fitness", "Yoga", "Hardlopen"]},
                    {"label_nl": "Hoe vaak wilt u komen?", "label_en": "How often do you want to come?", "field_type": "select", "options": ["1x per week", "2x per week", "meer dan 2x per week"]},
                    {"label_nl": "Waarom kiest u voor deze groepsles?", "label_en": "Why do you choose this group class?", "field_type": "textarea"},
                    {"label_nl": "Hoe is uw gezondheid?", "label_en": "How is your health?", "field_type": "textarea"},
                ],
                "instructions_nl": "Vul het formulier in.",
                "instructions_en": "Fill in the form.",
                "model_answers": {
                    "Voor- en achternaam": "Maria de Vries",
                    "Adres": "Hoofdstraat 12",
                    "Postcode": "1234 AB",
                    "Woonplaats": "Amsterdam",
                    "Telefoonnummer": "06-12345678",
                    "Geslacht": "vrouw",
                    "Geboortedatum": "15-03-1990",
                    "Welke groepsles wilt u nu gaan doen?": "Yoga",
                    "Hoe vaak wilt u komen?": "2x per week",
                    "Waarom kiest u voor deze groepsles?": "Ik kies voor yoga omdat ik veel stress heb op mijn werk. Yoga helpt mij om te ontspannen.",
                    "Hoe is uw gezondheid?": "Mijn gezondheid is goed. Ik heb geen klachten.",
                },
            },
            {
                "id": "s1_t4",
                "task_type": "email",
                "title": "Dienst ruilen",
                "situation_nl": "U moet zondag werken maar u wilt graag vrij. U schrijft daarom een e-mail aan uw collega Farida. U vraagt of zij met u wil ruilen.",
                "situation_en": "You have to work on Sunday but you would like to be free. You write an email to your colleague Farida. You ask if she wants to swap shifts.",
                "recipient": "Farida",
                "bullet_points": [
                    {"nl": "Schrijf op waarom u mailt.", "en": "Write why you are mailing."},
                    {"nl": "Schrijf waarom u wilt ruilen. Bedenk het zelf.", "en": "Write why you want to swap. Make up a reason yourself."},
                    {"nl": "Schrijf op welke dag u wel kunt werken.", "en": "Write on which day you can work."},
                ],
                "instructions_nl": "Schrijf de e-mail. Schrijf in hele zinnen.",
                "instructions_en": "Write the email. Write in complete sentences.",
                "model_answer": "Hallo Farida,\n\nIk mail je omdat ik een vraag heb. Ik moet zondag werken, maar mijn moeder is jarig en ik wil graag naar haar feestje. Wil je met mij ruilen? Ik kan dan maandag voor jou werken.\n\nGroeten,\n[naam]",
            },
        ],
    },
    # ── Oefenexamen 2 ─────────────────────────────────────────────────────────
    {
        "id": "schrijven_2",
        "title": "Schrijven A2 Oefenexamen 2",
        "tasks": [
            {
                "id": "s2_t1",
                "task_type": "kort_verhaal",
                "title": "Mooiste kleren",
                "situation_nl": "U krijgt elke week een wijkkrant. Iedereen uit de buurt mag iets voor deze krant schrijven. U schrijft over de kleren die u het liefst draagt.",
                "situation_en": "You receive a neighbourhood newspaper every week. Everyone in the neighbourhood may write something for it. You write about the clothes you like to wear most.",
                "guiding_questions": [
                    {"nl": "Wat draagt u het liefst?", "en": "What do you like to wear most?"},
                    {"nl": "Hoe zien de kleren eruit?", "en": "What do the clothes look like?"},
                    {"nl": "Wanneer draagt u deze kleren?", "en": "When do you wear these clothes?"},
                ],
                "instructions_nl": "Schrijf minimaal drie zinnen op. Schrijf in hele zinnen.",
                "instructions_en": "Write at least three sentences. Write in complete sentences.",
                "starter_text": "Dit is mijn tekst over de kleren die ik het liefst draag:",
                "model_answer": "Ik draag het liefst een spijkerbroek en een witte blouse. De blouse heeft lange mouwen en is heel comfortabel. Ik draag deze kleren als ik naar mijn werk ga. In het weekend draag ik liever een joggingbroek.",
            },
            {
                "id": "s2_t2",
                "task_type": "email",
                "title": "Boek lenen",
                "situation_nl": "Voor uw opleiding Techniek heeft u snel het boek 'Natuurkunde 1' nodig. In de bibliotheek is het boek niet. Een medestudente heeft het boek. U wilt het boek van haar lenen. U schrijft haar een e-mail.",
                "situation_en": "For your Technology course you urgently need the book 'Natuurkunde 1'. The book is not in the library. A fellow student has the book. You want to borrow it from her. You write her an email.",
                "recipient": "Wilma",
                "bullet_points": [
                    {"nl": "U schrijft welk boek u wilt lenen.", "en": "Write which book you want to borrow."},
                    {"nl": "U schrijft waarom u het boek van haar wilt lenen.", "en": "Write why you want to borrow the book from her."},
                    {"nl": "U schrijft wanneer ze het boek terugkrijgt. Bedenk zelf wanneer.", "en": "Write when she will get the book back. Make up a date yourself."},
                ],
                "instructions_nl": "Schrijf de e-mail. Schrijf in hele zinnen.",
                "instructions_en": "Write the email. Write in complete sentences.",
                "model_answer": "Hallo Wilma,\n\nIk wil je iets vragen. Mag ik het boek Natuurkunde 1 van je lenen? Ik heb het nodig voor mijn opleiding en het is niet in de bibliotheek. Je krijgt het boek volgende week maandag terug.\n\nAlvast bedankt!\nGroeten,\n[naam]",
            },
            {
                "id": "s2_t3",
                "task_type": "formulier",
                "title": "Ingebroken",
                "situation_nl": "Er is ingebroken in uw huis. Dieven hebben spullen meegenomen en er is schade. U vult een schadeformulier in van uw verzekering. Bedenk zelf de gegevens.",
                "situation_en": "There has been a break-in at your house. Thieves took things and there is damage. You fill in a damage form from your insurance. Make up the details yourself.",
                "form_title_nl": "Schadeformulier inboedelverzekering",
                "form_title_en": "Home contents insurance damage form",
                "fields": [
                    {"label_nl": "Achternaam", "label_en": "Last name", "field_type": "text"},
                    {"label_nl": "Voorletters", "label_en": "Initials", "field_type": "text"},
                    {"label_nl": "Adres", "label_en": "Address", "field_type": "text"},
                    {"label_nl": "Telefoonnummer", "label_en": "Phone number", "field_type": "text"},
                    {"label_nl": "E-mail", "label_en": "Email", "field_type": "text"},
                    {"label_nl": "Datum van de schade", "label_en": "Date of the damage", "field_type": "text", "placeholder": "dd-mm-jjjj"},
                    {"label_nl": "Omschrijving gestolen spullen en schade (1)", "label_en": "Description of stolen items and damage (1) — e.g. item stolen", "field_type": "textarea"},
                    {"label_nl": "Omschrijving gestolen spullen en schade (2)", "label_en": "Description of stolen items and damage (2) — e.g. item stolen", "field_type": "textarea"},
                    {"label_nl": "Omschrijving gestolen spullen en schade (3)", "label_en": "Description of stolen items and damage (3) — e.g. item broken", "field_type": "textarea"},
                ],
                "instructions_nl": "Vul het formulier in. Schrijf op wanneer er is ingebroken. Schrijf drie dingen op die zijn gebeurd.",
                "instructions_en": "Fill in the form. Write when the break-in happened. Write three things that happened.",
                "model_answers": {
                    "Achternaam": "De Vries",
                    "Voorletters": "M.",
                    "Adres": "Kerkstraat 8, 2345 CD Den Haag",
                    "Telefoonnummer": "06-98765432",
                    "E-mail": "m.devries@email.nl",
                    "Datum van de schade": "10-03-2026",
                    "Omschrijving gestolen spullen en schade (1)": "Mijn laptop is gestolen. Het is een zwarte laptop van het merk HP.",
                    "Omschrijving gestolen spullen en schade (2)": "Mijn fiets is gestolen. Het is een blauwe damesfiets.",
                    "Omschrijving gestolen spullen en schade (3)": "Het raam in de woonkamer is kapot. De dieven hebben het raam opengebroken.",
                },
            },
            {
                "id": "s2_t4",
                "task_type": "email",
                "title": "Vrije dag aanvragen",
                "situation_nl": "U wilt volgende week een dag vrij vragen. U schrijft een e-mail aan uw chef, meneer Jansen.",
                "situation_en": "You want to ask for a day off next week. You write an email to your boss, Mr. Jansen.",
                "recipient": "meneer Jansen",
                "bullet_points": [
                    {"nl": "U schrijft wanneer u vrij wilt hebben. Bedenk zelf een dag en datum.", "en": "Write when you want to be free. Make up a day and date yourself."},
                    {"nl": "U schrijft waarom u vrij wilt hebben. Bedenk zelf waarom.", "en": "Write why you want to be free. Make up a reason yourself."},
                ],
                "instructions_nl": "Schrijf de e-mail. Schrijf in hele zinnen.",
                "instructions_en": "Write the email. Write in complete sentences.",
                "model_answer": "Geachte meneer Jansen,\n\nIk wil graag volgende week woensdag 18 maart vrij vragen. Ik moet naar het ziekenhuis voor een controle. Ik hoop dat dat mogelijk is.\n\nMet vriendelijke groet,\n[naam]",
            },
        ],
    },
    # ── Oefenexamen 3 ─────────────────────────────────────────────────────────
    {
        "id": "schrijven_3",
        "title": "Schrijven A2 Oefenexamen 3",
        "tasks": [
            {
                "id": "s3_t1",
                "task_type": "email",
                "title": "E-mail aan docent",
                "situation_nl": "U doet een computercursus. Morgen moet u een toets maken, maar u kunt niet naar school komen. U schrijft een e-mail aan uw docent.",
                "situation_en": "You are taking a computer course. Tomorrow you have a test, but you can't come to school. You write an email to your teacher.",
                "recipient": "docent (mr./mevr. Bakker)",
                "bullet_points": [
                    {"nl": "Schrijf waarom u de e-mail stuurt.", "en": "Write why you are sending the email."},
                    {"nl": "Schrijf waarom u niet kunt komen. Bedenk het zelf.", "en": "Write why you can't come. Make up a reason yourself."},
                    {"nl": "Bied uw excuses aan.", "en": "Offer your apologies."},
                    {"nl": "Vraag wanneer u de toets kunt maken.", "en": "Ask when you can take the test."},
                ],
                "instructions_nl": "Schrijf de e-mail. Schrijf in hele zinnen.",
                "instructions_en": "Write the email. Write in complete sentences.",
                "model_answer": "Geachte meneer/mevrouw Bakker,\n\nIk schrijf u omdat ik morgen niet naar school kan komen. Mijn dochter is ziek en ik moet thuis voor haar zorgen. Het spijt mij dat ik de toets niet kan maken. Kunt u mij vertellen wanneer ik de toets een andere keer kan maken?\n\nMet vriendelijke groet,\n[naam]",
            },
            {
                "id": "s3_t2",
                "task_type": "formulier",
                "title": "Problemen in de straat",
                "situation_nl": "In de straat waar u woont zijn twee problemen. U meldt de problemen bij de gemeente. Sommige gegevens moet u zelf bedenken.",
                "situation_en": "In the street where you live there are two problems. You report the problems to the municipality. You have to make up some information yourself.",
                "form_title_nl": "Meldingsformulier gemeente",
                "form_title_en": "Municipality report form",
                "fields": [
                    {"label_nl": "Voor- en achternaam", "label_en": "First and last name", "field_type": "text"},
                    {"label_nl": "Adres", "label_en": "Address", "field_type": "text"},
                    {"label_nl": "Postcode", "label_en": "Postal code", "field_type": "text"},
                    {"label_nl": "Woonplaats", "label_en": "City", "field_type": "text"},
                    {"label_nl": "Telefoonnummer", "label_en": "Phone number", "field_type": "text"},
                    {"label_nl": "E-mail", "label_en": "Email", "field_type": "text"},
                    {"label_nl": "In welke straat zijn er problemen?", "label_en": "In which street are the problems?", "field_type": "text"},
                    {"label_nl": "Wat zijn de problemen?", "label_en": "What are the problems? (describe two problems)", "field_type": "textarea", "placeholder": "Beschrijf twee problemen in uw straat..."},
                ],
                "instructions_nl": "Vul het formulier van de gemeente in.",
                "instructions_en": "Fill in the municipality form.",
                "model_answers": {
                    "Voor- en achternaam": "Ahmed Hassan",
                    "Adres": "Dorpsstraat 23",
                    "Postcode": "3456 EF",
                    "Woonplaats": "Utrecht",
                    "Telefoonnummer": "06-11223344",
                    "E-mail": "a.hassan@email.nl",
                    "In welke straat zijn er problemen?": "Dorpsstraat",
                    "Wat zijn de problemen?": "Er ligt veel afval op straat. Mensen gooien hun vuilnis naast de container. Ook is er een lantaarnpaal die niet meer werkt. Het is 's avonds heel donker en dat is gevaarlijk.",
                },
            },
            {
                "id": "s3_t3",
                "task_type": "kort_verhaal",
                "title": "Weekend",
                "situation_nl": "U krijgt elke week een wijkkrant. Iedereen uit de buurt mag iets voor deze krant schrijven. U schrijft over uw weekend.",
                "situation_en": "You receive a neighbourhood newspaper every week. Everyone in the neighbourhood may write something for it. You write about your weekend.",
                "guiding_questions": [
                    {"nl": "Wat doet u graag in het weekend?", "en": "What do you like to do on the weekend?"},
                    {"nl": "Met wie doet u dat?", "en": "Who do you do it with?"},
                    {"nl": "Waar doet u dat?", "en": "Where do you do it?"},
                ],
                "instructions_nl": "Schrijf minimaal drie zinnen op. Schrijf in hele zinnen.",
                "instructions_en": "Write at least three sentences. Write in complete sentences.",
                "starter_text": "Dit is mijn tekst over mijn weekend:",
                "model_answer": "In het weekend ga ik graag wandelen met mijn gezin. We gaan naar het park bij ons in de buurt. De kinderen spelen op de speeltuin en ik wandel met mijn vrouw. Daarna eten we soms pannenkoeken in een restaurant. Ik vind het weekend altijd heel fijn.",
            },
            {
                "id": "s3_t4",
                "task_type": "email",
                "title": "Bericht collega",
                "situation_nl": "U werkt in een kledingzaak. Straks komt uw collega Fariha. Zij moet een paar dingen doen. Schrijf een briefje voor Fariha. Vertel wat zij moet doen. Schrijf drie dingen op.",
                "situation_en": "You work in a clothing shop. Your colleague Fariha is coming soon. She has to do a few things. Write a note for Fariha. Tell her what she has to do. Write three things.",
                "recipient": "Fariha",
                "bullet_points": [
                    {"nl": "Schrijf drie dingen op die Fariha moet doen (bijv. dozen uitpakken, de winkel schoonmaken, kleren ophangen).", "en": "Write three things Fariha has to do (e.g. unpack boxes, clean the shop, hang up clothes)."},
                ],
                "instructions_nl": "Schrijf een briefje. Schrijf in hele zinnen.",
                "instructions_en": "Write a note. Write in complete sentences.",
                "greeting": "Hallo Fariha,",
                "closing": "Alvast bedankt!\nGroeten,",
                "model_answer": "Hallo Fariha,\n\nEr zijn een paar dingen die je moet doen. Kun je de nieuwe dozen uitpakken? De kleren moeten op de rekken gehangen worden. En de paskamers moeten schoongemaakt worden.\n\nAlvast bedankt!\nGroeten,\n[naam]",
            },
        ],
    },
]


def get_schrijven_exam_list() -> list[dict]:
    """Return schrijven exam summaries."""
    result = []
    for exam in SCHRIJVEN_EXAMS:
        task_count = len(exam["tasks"])
        task_types = {}
        for t in exam["tasks"]:
            tt = t["task_type"]
            task_types[tt] = task_types.get(tt, 0) + 1
        result.append({
            "id": exam["id"],
            "title": exam["title"],
            "task_count": task_count,
            "task_types": task_types,
        })
    return result


def get_schrijven_exam(exam_id: str) -> dict | None:
    """Return full exam data by ID."""
    for exam in SCHRIJVEN_EXAMS:
        if exam["id"] == exam_id:
            return exam
    return None


def get_schrijven_task(exam_id: str, task_id: str) -> dict | None:
    """Return a single task from a schrijven exam."""
    exam = get_schrijven_exam(exam_id)
    if not exam:
        return None
    for task in exam["tasks"]:
        if task["id"] == task_id:
            return task
    return None
