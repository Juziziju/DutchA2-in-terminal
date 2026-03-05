"""
Inburgeringsexamen A2 Practice Question Bank

Realistic practice questions for all 5 sections of the Dutch civic integration exam.
All content is original practice material at A2 (CEFR) level.
"""

EXAM_BANK = {
    # =========================================================================
    # LEZEN (Reading Comprehension) — 5 questions
    # =========================================================================
    "LZ": [
        {
            "id": "lz_1",
            "text_nl": (
                "BERICHT VAN DE HUISARTS\n\n"
                "Beste patienten,\n\n"
                "Vanaf 1 maart zijn onze openingstijden veranderd.\n"
                "Maandag t/m vrijdag: 08:00 - 17:00\n"
                "Zaterdag en zondag: gesloten\n\n"
                "Herhaalrecepten kunt u online aanvragen via onze website "
                "of bel naar 020-555 1234.\n"
                "Heeft u dringend hulp nodig buiten openingstijden? "
                "Bel de huisartsenpost: 0900-1515.\n\n"
                "Met vriendelijke groet,\n"
                "Huisartsenpraktijk De Linde"
            ),
            "text_en": (
                "MESSAGE FROM THE GP\n\n"
                "Dear patients,\n\n"
                "From 1 March our opening hours have changed.\n"
                "Monday to Friday: 08:00 - 17:00\n"
                "Saturday and Sunday: closed\n\n"
                "Repeat prescriptions can be requested online via our website "
                "or call 020-555 1234.\n"
                "Do you need urgent help outside opening hours? "
                "Call the after-hours GP service: 0900-1515.\n\n"
                "Kind regards,\n"
                "GP Practice De Linde"
            ),
            "question_nl": "Wat moet u doen als u op zondagavond ziek wordt?",
            "question_en": "What should you do if you get sick on Sunday evening?",
            "options": {
                "A": "Naar de huisartsenpraktijk gaan",
                "B": "De huisartsenpost bellen: 0900-1515",
                "C": "Een herhaalrecept aanvragen op de website",
                "D": "Bellen naar 020-555 1234",
            },
            "answer": "B",
            "explanation_en": (
                "The notice says to call the huisartsenpost (0900-1515) for urgent "
                "help outside opening hours. Sunday is outside opening hours."
            ),
        },
        {
            "id": "lz_2",
            "text_nl": (
                "TE KOOP\n\n"
                "Tweedehands fiets - damesmodel\n"
                "Kleur: zwart, 3 versnellingen\n"
                "Goede staat, nieuw achterlicht\n"
                "Prijs: EUR 85,-\n"
                "Alleen afhalen in Utrecht-Centrum\n"
                "Bel of WhatsApp: 06-12345678\n"
                "Vraag naar Fatima"
            ),
            "text_en": (
                "FOR SALE\n\n"
                "Second-hand bicycle - ladies' model\n"
                "Colour: black, 3 gears\n"
                "Good condition, new rear light\n"
                "Price: EUR 85\n"
                "Pick-up only in Utrecht city centre\n"
                "Call or WhatsApp: 06-12345678\n"
                "Ask for Fatima"
            ),
            "question_nl": "Wat is waar over deze fiets?",
            "question_en": "What is true about this bicycle?",
            "options": {
                "A": "De fiets kan worden bezorgd",
                "B": "De fiets is nieuw",
                "C": "Je moet de fiets zelf ophalen",
                "D": "De fiets heeft geen licht",
            },
            "answer": "C",
            "explanation_en": (
                "The ad says 'Alleen afhalen' (pick-up only), meaning the buyer "
                "must collect it themselves in Utrecht city centre."
            ),
        },
        {
            "id": "lz_3",
            "text_nl": (
                "Beste bewoners van flat Zonnestein,\n\n"
                "Op donderdag 14 maart is er een bewoners-vergadering in de "
                "gemeenschappelijke ruimte op de begane grond.\n"
                "Tijd: 19:30 - 21:00 uur\n\n"
                "We bespreken:\n"
                "- het schoonmaken van de gangen\n"
                "- nieuwe regels voor het afval\n"
                "- de kapotte lift\n\n"
                "Kunt u niet komen? Stuur dan een e-mail naar "
                "bewonerscommissie@zonnestein.nl\n\n"
                "Graag tot dan!"
            ),
            "text_en": (
                "Dear residents of Zonnestein flat,\n\n"
                "On Thursday 14 March there is a residents' meeting in the "
                "communal room on the ground floor.\n"
                "Time: 19:30 - 21:00\n\n"
                "We will discuss:\n"
                "- cleaning the hallways\n"
                "- new rules for waste\n"
                "- the broken lift\n\n"
                "Can't attend? Please send an email to "
                "bewonerscommissie@zonnestein.nl\n\n"
                "Hope to see you there!"
            ),
            "question_nl": "Wat is GEEN onderwerp van de vergadering?",
            "question_en": "What is NOT a topic of the meeting?",
            "options": {
                "A": "De schoonmaak van de gangen",
                "B": "Nieuwe regels voor parkeren",
                "C": "De kapotte lift",
                "D": "Regels voor het afval",
            },
            "answer": "B",
            "explanation_en": (
                "Parking rules are not mentioned. The three topics are: cleaning "
                "hallways, waste rules, and the broken lift."
            ),
        },
        {
            "id": "lz_4",
            "text_nl": (
                "BIBLIOTHEEK OOST\n"
                "Openingstijden:\n"
                "Ma: gesloten\n"
                "Di t/m vr: 10:00 - 18:00\n"
                "Za: 10:00 - 16:00\n"
                "Zo: 12:00 - 16:00\n\n"
                "Boeken lenen is gratis voor kinderen tot 18 jaar.\n"
                "Volwassenen betalen EUR 25,- per jaar.\n"
                "U heeft een geldig identiteitsbewijs nodig om lid te worden."
            ),
            "text_en": (
                "LIBRARY EAST\n"
                "Opening hours:\n"
                "Mon: closed\n"
                "Tue to Fri: 10:00 - 18:00\n"
                "Sat: 10:00 - 16:00\n"
                "Sun: 12:00 - 16:00\n\n"
                "Borrowing books is free for children under 18.\n"
                "Adults pay EUR 25 per year.\n"
                "You need a valid ID to become a member."
            ),
            "question_nl": "Hoeveel betaalt een kind van 10 jaar om boeken te lenen?",
            "question_en": "How much does a 10-year-old pay to borrow books?",
            "options": {
                "A": "EUR 25,- per jaar",
                "B": "EUR 10,- per jaar",
                "C": "Niets, het is gratis",
                "D": "EUR 12,50 per jaar",
            },
            "answer": "C",
            "explanation_en": (
                "The text states that borrowing is free (gratis) for children "
                "under 18. A 10-year-old qualifies."
            ),
        },
        {
            "id": "lz_5",
            "text_nl": (
                "TREINVERTRAGING\n\n"
                "Let op reizigers!\n"
                "Door werkzaamheden aan het spoor rijden er dit weekend "
                "(zaterdag 9 en zondag 10 maart) geen treinen tussen "
                "Amsterdam Centraal en Utrecht Centraal.\n\n"
                "Er rijden vervangende bussen.\n"
                "De bus vertrekt elk half uur vanaf bushalte P op het "
                "stationsplein.\n"
                "Reistijd met de bus: ongeveer 45 minuten.\n"
                "Uw OV-chipkaart is geldig in de bus."
            ),
            "text_en": (
                "TRAIN DELAY\n\n"
                "Attention travellers!\n"
                "Due to track maintenance this weekend (Saturday 9 and "
                "Sunday 10 March) no trains will run between Amsterdam "
                "Centraal and Utrecht Centraal.\n\n"
                "Replacement buses are running.\n"
                "The bus departs every half hour from bus stop P at the "
                "station square.\n"
                "Travel time by bus: approximately 45 minutes.\n"
                "Your OV-chipkaart is valid on the bus."
            ),
            "question_nl": "Hoe vaak vertrekt de vervangende bus?",
            "question_en": "How often does the replacement bus depart?",
            "options": {
                "A": "Elk kwartier",
                "B": "Elk half uur",
                "C": "Elk uur",
                "D": "Alleen 's ochtends",
            },
            "answer": "B",
            "explanation_en": (
                "The notice says 'De bus vertrekt elk half uur' - the bus "
                "departs every half hour."
            ),
        },
    ],

    # =========================================================================
    # LUISTEREN (Listening Comprehension) — 5 questions
    # =========================================================================
    "LU": [
        {
            "id": "lu_1",
            "scenario_nl": (
                "[Omroep in de supermarkt]\n"
                "\"Beste klanten, let op! Vandaag hebben wij een speciale "
                "aanbieding. Alle kaas van het merk Gouda Jong is nu twee "
                "voor de prijs van een. U vindt de kaas in gangpad 4. "
                "Deze aanbieding geldt alleen vandaag.\""
            ),
            "scenario_en": (
                "[Announcement in the supermarket]\n"
                "\"Dear customers, attention please! Today we have a special "
                "offer. All Gouda Jong brand cheese is now two for the price "
                "of one. You can find the cheese in aisle 4. "
                "This offer is valid today only.\""
            ),
            "question_nl": "Wat is de aanbieding?",
            "question_en": "What is the offer?",
            "options": {
                "A": "Alle kaas is 50% korting",
                "B": "Twee pakken kaas voor de prijs van een",
                "C": "Gratis kaas bij elke aankoop",
                "D": "Kaas is vandaag EUR 1,-",
            },
            "answer": "B",
            "explanation_en": (
                "The announcement says 'twee voor de prijs van een' - "
                "two for the price of one."
            ),
        },
        {
            "id": "lu_2",
            "scenario_nl": (
                "[Telefoongesprek]\n"
                "Receptionist: \"Tandartspraktijk Van Dijk, goedemorgen.\"\n"
                "Patient: \"Goedemorgen, ik wil graag een afspraak maken.\"\n"
                "Receptionist: \"Natuurlijk. Heeft u pijn?\"\n"
                "Patient: \"Nee, het is voor een gewone controle.\"\n"
                "Receptionist: \"Dan kan ik u inplannen op dinsdag 19 maart "
                "om 14:00 uur. Past dat?\"\n"
                "Patient: \"In de ochtend kan ik beter. Heeft u iets 's ochtends?\"\n"
                "Receptionist: \"Dan kan woensdag 20 maart om 09:30.\"\n"
                "Patient: \"Dat is prima. Dank u wel.\""
            ),
            "scenario_en": (
                "[Phone call]\n"
                "Receptionist: \"Van Dijk dental practice, good morning.\"\n"
                "Patient: \"Good morning, I would like to make an appointment.\"\n"
                "Receptionist: \"Of course. Are you in pain?\"\n"
                "Patient: \"No, it's for a regular check-up.\"\n"
                "Receptionist: \"Then I can schedule you on Tuesday 19 March "
                "at 14:00. Does that work?\"\n"
                "Patient: \"Mornings are better for me. Do you have anything "
                "in the morning?\"\n"
                "Receptionist: \"Then Wednesday 20 March at 09:30.\"\n"
                "Patient: \"That's fine. Thank you.\""
            ),
            "question_nl": "Wanneer is de afspraak?",
            "question_en": "When is the appointment?",
            "options": {
                "A": "Dinsdag 19 maart om 14:00",
                "B": "Woensdag 20 maart om 09:30",
                "C": "Dinsdag 19 maart om 09:30",
                "D": "Woensdag 20 maart om 14:00",
            },
            "answer": "B",
            "explanation_en": (
                "The patient preferred a morning time, so the receptionist "
                "offered Wednesday 20 March at 09:30, which the patient accepted."
            ),
        },
        {
            "id": "lu_3",
            "scenario_nl": (
                "[Voicemailbericht]\n"
                "\"Hallo, u spreekt met Karin van het uitzendbureau Werkstart. "
                "Ik bel over uw sollicitatie voor de baan als magazijnmedewerker. "
                "Wij willen u graag uitnodigen voor een gesprek. "
                "Kunt u volgende week dinsdag om 10 uur bij ons op kantoor zijn? "
                "Ons adres is Keizersgracht 120 in Amsterdam. "
                "Neem alstublieft uw ID en uw CV mee. "
                "Belt u mij terug op 020-555 9876? Dank u wel.\""
            ),
            "scenario_en": (
                "[Voicemail message]\n"
                "\"Hello, this is Karin from Werkstart employment agency. "
                "I'm calling about your application for the warehouse worker "
                "position. We would like to invite you for an interview. "
                "Can you be at our office next Tuesday at 10 o'clock? "
                "Our address is Keizersgracht 120 in Amsterdam. "
                "Please bring your ID and your CV. "
                "Can you call me back on 020-555 9876? Thank you.\""
            ),
            "question_nl": "Wat moet de persoon meenemen naar het gesprek?",
            "question_en": "What should the person bring to the interview?",
            "options": {
                "A": "Alleen een CV",
                "B": "Een ID en een CV",
                "C": "Een ID en diploma's",
                "D": "Niets, alles staat online",
            },
            "answer": "B",
            "explanation_en": (
                "Karin says 'Neem alstublieft uw ID en uw CV mee' - "
                "please bring your ID and your CV."
            ),
        },
        {
            "id": "lu_4",
            "scenario_nl": (
                "[Gesprek bij de balie van het gemeentehuis]\n"
                "Medewerker: \"Goedemiddag. Wat kan ik voor u doen?\"\n"
                "Bezoeker: \"Ik wil mijn rijbewijs verlengen.\"\n"
                "Medewerker: \"Heeft u een pasfoto en uw oude rijbewijs bij u?\"\n"
                "Bezoeker: \"Ja, allebei.\"\n"
                "Medewerker: \"Mooi. Het kost EUR 41,50. "
                "U kunt alleen met pin betalen, niet contant.\"\n"
                "Bezoeker: \"Oké, dat is goed.\"\n"
                "Medewerker: \"Het nieuwe rijbewijs is over vijf werkdagen klaar. "
                "U krijgt een sms als u het kunt ophalen.\""
            ),
            "scenario_en": (
                "[Conversation at the town hall desk]\n"
                "Employee: \"Good afternoon. How can I help you?\"\n"
                "Visitor: \"I want to renew my driving licence.\"\n"
                "Employee: \"Do you have a passport photo and your old licence "
                "with you?\"\n"
                "Visitor: \"Yes, both.\"\n"
                "Employee: \"Good. It costs EUR 41.50. "
                "You can only pay by debit card, not cash.\"\n"
                "Visitor: \"Okay, that's fine.\"\n"
                "Employee: \"The new licence will be ready in five working days. "
                "You'll receive a text message when you can pick it up.\""
            ),
            "question_nl": "Hoe kan de bezoeker betalen?",
            "question_en": "How can the visitor pay?",
            "options": {
                "A": "Alleen contant",
                "B": "Contant of met pin",
                "C": "Alleen met pin",
                "D": "Met creditcard",
            },
            "answer": "C",
            "explanation_en": (
                "The employee says 'U kunt alleen met pin betalen, niet contant' - "
                "you can only pay by debit card, not cash."
            ),
        },
        {
            "id": "lu_5",
            "scenario_nl": (
                "[Omroep op het station]\n"
                "\"Dames en heren, de intercity naar Rotterdam Centraal van "
                "15:07 vertrekt vandaag niet van spoor 3, maar van spoor 8. "
                "Ik herhaal: de intercity van 15:07 naar Rotterdam vertrekt "
                "vanaf spoor 8. De trein heeft een vertraging van ongeveer "
                "5 minuten. Excuses voor het ongemak.\""
            ),
            "scenario_en": (
                "[Announcement at the station]\n"
                "\"Ladies and gentlemen, the intercity to Rotterdam Centraal "
                "at 15:07 will not depart from platform 3 today, but from "
                "platform 8. I repeat: the 15:07 intercity to Rotterdam "
                "departs from platform 8. The train has a delay of "
                "approximately 5 minutes. Apologies for the inconvenience.\""
            ),
            "question_nl": "Vanaf welk spoor vertrekt de trein naar Rotterdam?",
            "question_en": "From which platform does the train to Rotterdam depart?",
            "options": {
                "A": "Spoor 3",
                "B": "Spoor 5",
                "C": "Spoor 8",
                "D": "Spoor 15",
            },
            "answer": "C",
            "explanation_en": (
                "The announcement says the train was moved from platform 3 to "
                "platform 8 (spoor 8)."
            ),
        },
    ],

    # =========================================================================
    # SCHRIJVEN (Writing) — 3 tasks
    # =========================================================================
    "SC": [
        {
            "id": "sc_1",
            "prompt_nl": (
                "U bent ziek en kunt morgen niet naar uw cursus Nederlands gaan."
            ),
            "prompt_en": (
                "You are sick and cannot go to your Dutch course tomorrow."
            ),
            "task_nl": (
                "Schrijf een e-mail aan uw docent. Vertel:\n"
                "- dat u ziek bent\n"
                "- dat u morgen niet kunt komen\n"
                "- vraag of u het huiswerk later kunt inleveren"
            ),
            "task_en": (
                "Write an email to your teacher. Tell them:\n"
                "- that you are sick\n"
                "- that you cannot come tomorrow\n"
                "- ask if you can hand in the homework later"
            ),
            "model_answer": (
                "Beste mevrouw De Vries,\n\n"
                "Ik ben helaas ziek. Ik heb koorts en hoofdpijn. "
                "Daarom kan ik morgen niet naar de les komen.\n\n"
                "Mag ik het huiswerk later inleveren? Ik hoop dat ik "
                "volgende week weer beter ben.\n\n"
                "Met vriendelijke groet,\n"
                "Ahmed"
            ),
            "key_points": [
                "Greeting (Beste / Geachte + name)",
                "Mention being sick (ziek zijn)",
                "State absence (niet komen / niet naar de les)",
                "Ask about homework (huiswerk later inleveren)",
                "Closing (Met vriendelijke groet)",
            ],
        },
        {
            "id": "sc_2",
            "prompt_nl": (
                "U heeft een pakje besteld bij een webwinkel. "
                "Het pakje is kapot aangekomen."
            ),
            "prompt_en": (
                "You ordered a package from an online shop. "
                "The package arrived damaged."
            ),
            "task_nl": (
                "Schrijf een bericht aan de klantenservice. Vertel:\n"
                "- wat u heeft besteld\n"
                "- wanneer het pakje is aangekomen\n"
                "- wat het probleem is\n"
                "- wat u wilt (nieuw product of geld terug)"
            ),
            "task_en": (
                "Write a message to customer service. Tell them:\n"
                "- what you ordered\n"
                "- when the package arrived\n"
                "- what the problem is\n"
                "- what you want (new product or money back)"
            ),
            "model_answer": (
                "Geachte klantenservice,\n\n"
                "Op 5 maart heb ik een koffiezetapparaat besteld "
                "(bestelnummer 12345). Het pakje is gisteren aangekomen, "
                "maar het apparaat is kapot. Er zit een grote scheur in "
                "het glas.\n\n"
                "Ik wil graag een nieuw apparaat ontvangen of mijn geld "
                "terug krijgen.\n\n"
                "Kunt u mij laten weten wat de mogelijkheden zijn?\n\n"
                "Met vriendelijke groet,\n"
                "Maria Santos"
            ),
            "key_points": [
                "Formal greeting (Geachte klantenservice)",
                "Describe what was ordered",
                "Mention arrival date",
                "Explain the damage (kapot / beschadigd)",
                "State desired resolution (nieuw product / geld terug)",
                "Polite closing",
            ],
        },
        {
            "id": "sc_3",
            "prompt_nl": (
                "Uw buurvrouw heeft een feest. U bent uitgenodigd maar "
                "u kunt niet komen."
            ),
            "prompt_en": (
                "Your neighbour is having a party. You are invited but "
                "you cannot come."
            ),
            "task_nl": (
                "Schrijf een kort briefje aan uw buurvrouw. Vertel:\n"
                "- bedank haar voor de uitnodiging\n"
                "- leg uit waarom u niet kunt komen\n"
                "- wens haar een leuk feest"
            ),
            "task_en": (
                "Write a short note to your neighbour. Tell her:\n"
                "- thank her for the invitation\n"
                "- explain why you cannot come\n"
                "- wish her a nice party"
            ),
            "model_answer": (
                "Lieve Sandra,\n\n"
                "Dank je wel voor de uitnodiging voor je feest! "
                "Helaas kan ik niet komen, want ik moet die avond werken. "
                "Ik vind het heel jammer.\n\n"
                "Ik wens je een heel leuk feest!\n\n"
                "Groetjes,\n"
                "Yuki"
            ),
            "key_points": [
                "Informal greeting (Lieve / Hoi + name)",
                "Thank for the invitation (bedanken voor de uitnodiging)",
                "Give a reason for not attending",
                "Express regret (jammer)",
                "Wish a nice party (leuk feest)",
                "Informal closing (Groetjes)",
            ],
        },
    ],

    # =========================================================================
    # SPREKEN (Speaking) — 3 prompts
    # =========================================================================
    "SP": [
        {
            "id": "sp_1",
            "situation_nl": (
                "U bent bij de huisarts. U heeft al drie dagen buikpijn. "
                "Vertel de dokter wat er aan de hand is, wanneer het begon, "
                "en vraag wat u moet doen."
            ),
            "situation_en": (
                "You are at the GP. You have had stomach pain for three days. "
                "Tell the doctor what is wrong, when it started, "
                "and ask what you should do."
            ),
            "expected_phrases": [
                "Ik heb buikpijn",
                "Het is drie dagen geleden begonnen",
                "Sinds drie dagen / al drie dagen",
                "Het doet hier pijn (pointing)",
                "Wat moet ik doen?",
                "Moet ik medicijnen nemen?",
                "Heeft u iets voor de pijn?",
            ],
        },
        {
            "id": "sp_2",
            "situation_nl": (
                "U staat in de supermarkt en kunt de rijst niet vinden. "
                "Vraag een medewerker om hulp. Vraag ook naar de prijs "
                "en of er een aanbieding is."
            ),
            "situation_en": (
                "You are in the supermarket and cannot find the rice. "
                "Ask a staff member for help. Also ask about the price "
                "and whether there is a special offer."
            ),
            "expected_phrases": [
                "Pardon / Excuseer mij",
                "Kunt u mij helpen?",
                "Waar kan ik rijst vinden?",
                "In welk gangpad staat de rijst?",
                "Hoeveel kost het?",
                "Is er een aanbieding?",
                "Dank u wel",
            ],
        },
        {
            "id": "sp_3",
            "situation_nl": (
                "U belt naar de school van uw kind. Uw kind is ziek en "
                "kan vandaag niet naar school. Vertel wat er aan de hand is "
                "en vraag of er huiswerk is."
            ),
            "situation_en": (
                "You are calling your child's school. Your child is sick "
                "and cannot go to school today. Explain what is going on "
                "and ask if there is homework."
            ),
            "expected_phrases": [
                "Goedemorgen, u spreekt met ...",
                "Ik bel over mijn zoon/dochter",
                "Mijn zoon/dochter is ziek",
                "Hij/Zij kan vandaag niet naar school komen",
                "Hij/Zij heeft koorts / is verkouden",
                "Is er huiswerk voor vandaag?",
                "Kunt u de juf/meester laten weten?",
                "Dank u wel, tot ziens",
            ],
        },
    ],

    # =========================================================================
    # KNM (Kennis van de Nederlandse Maatschappij) — 5 questions
    # =========================================================================
    "KNM": [
        {
            "id": "knm_1",
            "question_nl": (
                "U bent ziek en kunt niet naar uw werk. "
                "Wat moet u als eerste doen?"
            ),
            "question_en": (
                "You are sick and cannot go to work. "
                "What should you do first?"
            ),
            "options": {
                "A": "Naar de huisarts gaan",
                "B": "Uw werkgever zo snel mogelijk bellen om u ziek te melden",
                "C": "Een e-mail sturen naar het UWV",
            },
            "answer": "B",
            "explanation_en": (
                "In the Netherlands, you must call your employer as soon as "
                "possible to report sick (ziek melden). This is the first step. "
                "Visiting the GP is only needed if symptoms persist or are serious."
            ),
        },
        {
            "id": "knm_2",
            "question_nl": (
                "In Nederland moeten alle inwoners een zorgverzekering hebben. "
                "Vanaf welke leeftijd moet u zelf een basisverzekering afsluiten?"
            ),
            "question_en": (
                "In the Netherlands, all residents must have health insurance. "
                "From what age must you take out basic insurance yourself?"
            ),
            "options": {
                "A": "Vanaf 16 jaar",
                "B": "Vanaf 18 jaar",
                "C": "Vanaf 21 jaar",
            },
            "answer": "B",
            "explanation_en": (
                "Everyone aged 18 and over must have their own basic health "
                "insurance (basisverzekering). Children under 18 are insured "
                "for free through a parent's policy."
            ),
        },
        {
            "id": "knm_3",
            "question_nl": (
                "Uw kind is 5 jaar oud. Is uw kind verplicht om naar school "
                "te gaan?"
            ),
            "question_en": (
                "Your child is 5 years old. Is your child required to go "
                "to school?"
            ),
            "options": {
                "A": "Ja, de leerplicht begint op 5 jaar",
                "B": "Nee, de leerplicht begint pas op 6 jaar",
                "C": "Nee, de leerplicht begint pas op 7 jaar",
            },
            "answer": "A",
            "explanation_en": (
                "In the Netherlands, compulsory education (leerplicht) starts "
                "on the first school day of the month after a child turns 5. "
                "Children can attend school from age 4, but it becomes "
                "mandatory at 5."
            ),
        },
        {
            "id": "knm_4",
            "question_nl": (
                "U zoekt een huurwoning. Wat is de eerste stap als u een "
                "sociale huurwoning wilt?"
            ),
            "question_en": (
                "You are looking for a rental home. What is the first step "
                "if you want social housing?"
            ),
            "options": {
                "A": "Een makelaar bellen",
                "B": "U inschrijven bij een woningcorporatie of woonruimteverdeler",
                "C": "Een brief schrijven aan de gemeente",
            },
            "answer": "B",
            "explanation_en": (
                "To get social housing (sociale huurwoning), you must register "
                "with a housing corporation (woningcorporatie) or regional "
                "housing allocation service (e.g., WoningNet). Waiting times "
                "can be very long, especially in cities."
            ),
        },
        {
            "id": "knm_5",
            "question_nl": (
                "Wie is het staatshoofd van Nederland?"
            ),
            "question_en": (
                "Who is the head of state of the Netherlands?"
            ),
            "options": {
                "A": "De minister-president",
                "B": "De Koning",
                "C": "De voorzitter van de Tweede Kamer",
            },
            "answer": "B",
            "explanation_en": (
                "The King (currently King Willem-Alexander) is the head of state "
                "of the Netherlands. The minister-president (prime minister) is "
                "the head of government."
            ),
        },
    ],
}
