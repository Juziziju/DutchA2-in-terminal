"""Spreken A2 Oefenexamen data — mirrors the official DUO exam structure.

Each exam has 4 onderdelen (parts), each with 4 questions, totalling 16 questions.
- Onderdeel 1: Vragen met een situatie (situation description + question)
- Onderdeel 2: Fotoalbum (describe a photo)
- Onderdeel 3: Roltaken (role-play a situation)
- Onderdeel 4: Foto's vergelijken (compare photos, choose, explain)
"""

SPREKEN_EXAMS: list[dict] = [
    {
        "id": "oefenexamen_1",
        "title": "Spreken A2 Oefenexamen 1",
        "onderdelen": [
            {
                "nummer": 1,
                "titel": "Vragen beantwoorden",
                "beschrijving": "U hoort een situatie. Daarna beantwoordt u een vraag.",
                "beschrijving_en": "You hear a situation. Then you answer a question.",
                "vragen": [
                    {
                        "id": "oe1_o1_v1",
                        "situatie_nl": "U bent op een feestje. U ontmoet iemand.",
                        "situatie_en": "You are at a party. You meet someone.",
                        "vraag_nl": "Stel uzelf voor.",
                        "vraag_en": "Introduce yourself.",
                        "prep_seconds": 30,
                        "record_seconds": 30,
                        "model_answer": "Hallo, ik heet ... Ik kom uit ... Ik woon in ... Ik ben ... jaar oud. Aangenaam.",
                        "tips": ["Name", "Country of origin", "Where you live", "Age or occupation"],
                        "expected_phrases": ["ik heet", "ik kom uit", "ik woon in", "aangenaam"],
                        "question_type": "short",
                    },
                    {
                        "id": "oe1_o1_v2",
                        "situatie_nl": "U bent bij de huisarts. U voelt zich niet lekker.",
                        "situatie_en": "You are at the GP. You don't feel well.",
                        "vraag_nl": "Vertel de dokter wat er aan de hand is.",
                        "vraag_en": "Tell the doctor what's wrong.",
                        "prep_seconds": 30,
                        "record_seconds": 30,
                        "model_answer": "Goedemorgen dokter. Ik voel me niet lekker. Ik heb hoofdpijn en ik ben moe. Het is al drie dagen zo.",
                        "tips": ["Greeting", "Symptoms", "How long"],
                        "expected_phrases": ["ik voel", "niet lekker", "ik heb", "hoofdpijn", "pijn"],
                        "question_type": "short",
                    },
                    {
                        "id": "oe1_o1_v3",
                        "situatie_nl": "U belt naar de school van uw kind. Uw kind is ziek.",
                        "situatie_en": "You call your child's school. Your child is sick.",
                        "vraag_nl": "Vertel waarom u belt.",
                        "vraag_en": "Explain why you are calling.",
                        "prep_seconds": 30,
                        "record_seconds": 30,
                        "model_answer": "Goedemorgen, u spreekt met ... Ik bel omdat mijn zoon/dochter ziek is. Hij/zij kan vandaag niet naar school komen. Hij/zij heeft koorts.",
                        "tips": ["Introduce yourself", "Reason for calling", "What is wrong"],
                        "expected_phrases": ["ik bel", "mijn zoon", "mijn dochter", "ziek", "niet naar school"],
                        "question_type": "short",
                    },
                    {
                        "id": "oe1_o1_v4",
                        "situatie_nl": "U bent in de supermarkt. U kunt iets niet vinden.",
                        "situatie_en": "You are in the supermarket. You can't find something.",
                        "vraag_nl": "Vraag een medewerker om hulp.",
                        "vraag_en": "Ask a staff member for help.",
                        "prep_seconds": 30,
                        "record_seconds": 30,
                        "model_answer": "Pardon, kunt u mij helpen? Ik zoek de rijst. Waar kan ik dat vinden? Dank u wel.",
                        "tips": ["Polite greeting", "What you're looking for", "Thank them"],
                        "expected_phrases": ["pardon", "kunt u", "helpen", "ik zoek", "waar"],
                        "question_type": "short",
                    },
                ],
            },
            {
                "nummer": 2,
                "titel": "Fotoalbum",
                "beschrijving": "U ziet een foto. Vertel wat u op de foto ziet.",
                "beschrijving_en": "You see a photo. Describe what you see in the photo.",
                "vragen": [
                    {
                        "id": "oe1_o2_v1",
                        "situatie_nl": "U ziet een foto van een markt met groente en fruit.",
                        "situatie_en": "You see a photo of a market with vegetables and fruit.",
                        "vraag_nl": "Vertel wat u op de foto ziet. Gaat u vaak naar de markt? Waarom wel of niet?",
                        "vraag_en": "Describe what you see. Do you often go to the market? Why or why not?",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Op de foto zie ik een markt. Er zijn veel groenten en fruit. Ik zie tomaten, appels en bananen. Ik ga graag naar de markt. Het is goedkoper dan de supermarkt en alles is vers.",
                        "tips": ["Describe what you see", "Name specific items", "Give your opinion", "Explain why"],
                        "expected_phrases": ["op de foto", "ik zie", "markt", "groenten", "fruit"],
                        "question_type": "long",
                        "image_url": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&h=400&fit=crop",
                    },
                    {
                        "id": "oe1_o2_v2",
                        "situatie_nl": "U ziet een foto van een gezin dat samen eet aan tafel.",
                        "situatie_en": "You see a photo of a family eating together at the table.",
                        "vraag_nl": "Vertel wat u op de foto ziet. Eet u thuis vaak samen? Wat eet u graag?",
                        "vraag_en": "Describe what you see. Do you often eat together at home? What do you like to eat?",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Op de foto zie ik een gezin. Ze eten samen aan tafel. Er is een vader, een moeder en twee kinderen. Wij eten thuis ook altijd samen. Ik kook graag rijst met groenten. Mijn kinderen vinden pasta lekker.",
                        "tips": ["Describe the photo", "People and actions", "Your own experience", "Food preferences"],
                        "expected_phrases": ["op de foto", "ik zie", "gezin", "samen eten", "ik kook"],
                        "question_type": "long",
                        "image_url": "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&h=400&fit=crop",
                    },
                    {
                        "id": "oe1_o2_v3",
                        "situatie_nl": "U ziet een foto van kinderen die buiten spelen in een park.",
                        "situatie_en": "You see a photo of children playing outside in a park.",
                        "vraag_nl": "Vertel wat u op de foto ziet. Spelen uw kinderen ook buiten? Wat doen ze graag?",
                        "vraag_en": "Describe what you see. Do your children also play outside? What do they like to do?",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Op de foto zie ik kinderen die buiten spelen in een park. Ze zijn aan het rennen en spelen op de glijbaan. Mijn kinderen spelen ook graag buiten. Ze voetballen graag en ze fietsen ook veel.",
                        "tips": ["Describe the scene", "Activities you see", "Your children's activities"],
                        "expected_phrases": ["op de foto", "kinderen", "buiten spelen", "park", "mijn kinderen"],
                        "question_type": "long",
                        "image_url": "https://images.unsplash.com/photo-1540479859555-17af45c78602?w=600&h=400&fit=crop",
                    },
                    {
                        "id": "oe1_o2_v4",
                        "situatie_nl": "U ziet een foto van mensen die aan het werk zijn in een kantoor.",
                        "situatie_en": "You see a photo of people working in an office.",
                        "vraag_nl": "Vertel wat u op de foto ziet. Werkt u ook? Wat doet u voor werk?",
                        "vraag_en": "Describe what you see. Do you also work? What do you do for work?",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Op de foto zie ik mensen die werken in een kantoor. Ze zitten achter computers. Ik werk ook. Ik werk in een restaurant als kok. Ik werk vijf dagen per week. Ik vind mijn werk leuk.",
                        "tips": ["Describe the office scene", "Your own work situation", "How often you work"],
                        "expected_phrases": ["op de foto", "ik zie", "werken", "kantoor", "ik werk"],
                        "question_type": "long",
                        "image_url": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop",
                    },
                ],
            },
            {
                "nummer": 3,
                "titel": "Roltaken",
                "beschrijving": "U krijgt een situatie. U speelt een rol. Vertel wat u zou zeggen.",
                "beschrijving_en": "You get a situation. You play a role. Say what you would say.",
                "vragen": [
                    {
                        "id": "oe1_o3_v1",
                        "situatie_nl": "U wilt een afspraak maken bij de kapper. U belt de kapperszaak.",
                        "situatie_en": "You want to make an appointment at the hairdresser. You call the hair salon.",
                        "vraag_nl": "Maak een afspraak. Zeg wanneer u wilt komen en wat u wilt laten doen.",
                        "vraag_en": "Make an appointment. Say when you want to come and what you want done.",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Goedemorgen, ik wil graag een afspraak maken. Kan ik vrijdag om twee uur komen? Ik wil graag mijn haar laten knippen. Hoeveel kost dat? Dank u wel, tot vrijdag!",
                        "tips": ["Greeting", "Request appointment", "Preferred day/time", "What service", "Ask about price"],
                        "expected_phrases": ["afspraak maken", "ik wil graag", "knippen", "wanneer", "hoeveel kost"],
                        "question_type": "long",
                    },
                    {
                        "id": "oe1_o3_v2",
                        "situatie_nl": "Uw buurvrouw heeft een pakje voor u aangenomen. U gaat het ophalen.",
                        "situatie_en": "Your neighbour accepted a package for you. You go to pick it up.",
                        "vraag_nl": "Bedank uw buurvrouw en maak een praatje.",
                        "vraag_en": "Thank your neighbour and have a chat.",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Hallo buurvrouw, dank u wel voor het pakje! Dat is heel aardig van u. Hoe gaat het met u? Het weer is lekker vandaag, hè? Heeft u leuke plannen voor het weekend?",
                        "tips": ["Thank the neighbour", "Small talk", "Ask about their day"],
                        "expected_phrases": ["dank u wel", "pakje", "aardig", "hoe gaat het", "weer"],
                        "question_type": "long",
                    },
                    {
                        "id": "oe1_o3_v3",
                        "situatie_nl": "U bent op het station. Uw trein heeft vertraging. U vraagt informatie.",
                        "situatie_en": "You are at the train station. Your train is delayed. You ask for information.",
                        "vraag_nl": "Vraag wanneer de trein komt en of er een andere trein is.",
                        "vraag_en": "Ask when the train will arrive and if there is another train.",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Pardon meneer, mijn trein naar Utrecht heeft vertraging. Weet u wanneer de trein komt? Is er misschien een andere trein die ik kan nemen? Ik moet om drie uur in Utrecht zijn.",
                        "tips": ["Get attention politely", "Explain the problem", "Ask alternatives", "Mention urgency"],
                        "expected_phrases": ["pardon", "trein", "vertraging", "wanneer", "andere trein"],
                        "question_type": "long",
                    },
                    {
                        "id": "oe1_o3_v4",
                        "situatie_nl": "U heeft iets online gekocht maar het is kapot. U belt de klantenservice.",
                        "situatie_en": "You bought something online but it's broken. You call customer service.",
                        "vraag_nl": "Leg het probleem uit en vraag wat u kunt doen.",
                        "vraag_en": "Explain the problem and ask what you can do.",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Goedemiddag, ik bel over een bestelling. Ik heb vorige week een lamp gekocht maar hij is kapot. Hij doet het niet. Kan ik het terugsturen? Of kan ik een nieuwe krijgen? Ik heb het bestelnummer hier.",
                        "tips": ["Explain what you bought", "Describe the problem", "Ask for solution"],
                        "expected_phrases": ["ik bel over", "gekocht", "kapot", "terugsturen", "nieuwe"],
                        "question_type": "long",
                    },
                ],
            },
            {
                "nummer": 4,
                "titel": "Vergelijken en kiezen",
                "beschrijving": "U ziet foto's. U vergelijkt en kiest. Leg uit waarom.",
                "beschrijving_en": "You see photos. You compare and choose. Explain why.",
                "vragen": [
                    {
                        "id": "oe1_o4_v1",
                        "situatie_nl": "U zoekt een huis. U ziet twee opties: een appartement in de stad of een huis in een dorp.",
                        "situatie_en": "You are looking for a house. You see two options: an apartment in the city or a house in a village.",
                        "vraag_nl": "Vergelijk de twee opties. Welke kiest u? Waarom?",
                        "vraag_en": "Compare the two options. Which do you choose? Why?",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Ik zie twee opties. Het appartement in de stad is kleiner maar dichtbij winkels en school. Het huis in het dorp is groter en heeft een tuin. Ik kies het huis in het dorp, want ik heb kinderen en een tuin is fijn voor ze. Het is ook rustiger.",
                        "tips": ["Describe both options", "Name advantages/disadvantages", "Make your choice", "Explain why"],
                        "expected_phrases": ["ik zie", "appartement", "huis", "ik kies", "want", "omdat"],
                        "question_type": "long",
                        "image_url": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop",
                    },
                    {
                        "id": "oe1_o4_v2",
                        "situatie_nl": "U wilt een cursus volgen. U ziet twee opties: een taalcursus op school of een online taalcursus.",
                        "situatie_en": "You want to take a course. You see two options: a language course at school or an online language course.",
                        "vraag_nl": "Vergelijk de twee cursussen. Welke kiest u? Waarom?",
                        "vraag_en": "Compare the two courses. Which do you choose? Why?",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "De cursus op school is twee keer per week. Je leert met andere mensen samen. De online cursus kun je thuis doen, wanneer je wilt. Ik kies de cursus op school, want ik vind het fijn om met andere mensen te oefenen. Dat is beter voor spreken.",
                        "tips": ["Describe each option", "Pros and cons", "Your choice and reason"],
                        "expected_phrases": ["cursus", "school", "online", "ik kies", "want", "beter"],
                        "question_type": "long",
                        "image_url": "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&h=400&fit=crop",
                    },
                    {
                        "id": "oe1_o4_v3",
                        "situatie_nl": "U wilt een cadeau kopen voor een vriend. U ziet twee opties: een boek of een etentje in een restaurant.",
                        "situatie_en": "You want to buy a gift for a friend. You see two options: a book or a dinner at a restaurant.",
                        "vraag_nl": "Vergelijk de twee cadeaus. Welke kiest u? Waarom?",
                        "vraag_en": "Compare the two gifts. Which do you choose? Why?",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "Een boek is een mooi cadeau, maar je moet weten wat iemand leuk vindt. Een etentje is leuker, want dan kun je samen eten en praten. Ik kies het etentje, want ik wil graag samen tijd doorbrengen met mijn vriend.",
                        "tips": ["Compare both gifts", "Think about what's better", "Give your preference", "Explain your reasoning"],
                        "expected_phrases": ["boek", "etentje", "cadeau", "ik kies", "want", "samen"],
                        "question_type": "long",
                        "image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=400&fit=crop",
                    },
                    {
                        "id": "oe1_o4_v4",
                        "situatie_nl": "U wilt sporten. U ziet twee opties: een sportschool of buiten hardlopen.",
                        "situatie_en": "You want to exercise. You see two options: a gym or running outside.",
                        "vraag_nl": "Vergelijk de twee opties. Welke kiest u? Waarom?",
                        "vraag_en": "Compare the two options. Which do you choose? Why?",
                        "prep_seconds": 30,
                        "record_seconds": 60,
                        "model_answer": "De sportschool kost geld maar je hebt veel apparaten. Buiten hardlopen is gratis en je bent in de natuur. Ik kies buiten hardlopen, want het is gratis en ik vind het fijn om buiten te zijn. Als het regent ga ik naar de sportschool.",
                        "tips": ["Describe both options", "Cost, convenience, enjoyment", "Your choice", "Maybe a compromise"],
                        "expected_phrases": ["sportschool", "hardlopen", "buiten", "ik kies", "want", "gratis"],
                        "question_type": "long",
                        "image_url": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop",
                    },
                ],
            },
        ],
    },
]


def get_spreken_exam_list() -> list[dict]:
    """Return spreken exam summaries."""
    result = []
    for exam in SPREKEN_EXAMS:
        onderdeel_count = len(exam["onderdelen"])
        question_count = sum(len(o["vragen"]) for o in exam["onderdelen"])
        result.append({
            "id": exam["id"],
            "title": exam["title"],
            "onderdeel_count": onderdeel_count,
            "question_count": question_count,
        })
    return result


def get_spreken_exam(exam_id: str) -> dict | None:
    """Return full exam data by ID."""
    for exam in SPREKEN_EXAMS:
        if exam["id"] == exam_id:
            return exam
    return None


def get_spreken_question(exam_id: str, question_id: str) -> dict | None:
    """Return a single question from a spreken exam."""
    exam = get_spreken_exam(exam_id)
    if not exam:
        return None
    for onderdeel in exam["onderdelen"]:
        for vraag in onderdeel["vragen"]:
            if vraag["id"] == question_id:
                return vraag
    return None
