export interface WritingSubtopic {
  key: string;
  label_nl: string;
  label_en: string;
  description: string;
}

export const WRITING_SUBTOPICS_LOCAL: Record<string, WritingSubtopic[]> = {
  email: [
    { key: "afspraak_verzetten", label_nl: "Afspraak verzetten", label_en: "Reschedule appointment", description: "" },
    { key: "dienst_ruilen", label_nl: "Dienst ruilen", label_en: "Swap work shifts", description: "" },
    { key: "boek_lenen", label_nl: "Iets lenen", label_en: "Borrow something", description: "" },
    { key: "vrije_dag", label_nl: "Vrije dag aanvragen", label_en: "Request day off", description: "" },
    { key: "email_docent", label_nl: "Email aan docent", label_en: "Email to teacher", description: "" },
    { key: "ziek_melden", label_nl: "Ziek melden", label_en: "Call in sick", description: "" },
    { key: "informatie_vragen", label_nl: "Informatie vragen", label_en: "Ask for information", description: "" },
    { key: "klacht", label_nl: "Klacht schrijven", label_en: "Write a complaint", description: "" },
  ],
  kort_verhaal: [
    { key: "feest", label_nl: "Een feest", label_en: "A party/celebration", description: "" },
    { key: "mooiste_kleren", label_nl: "Mooiste kleren", label_en: "Favourite clothes", description: "" },
    { key: "weekend", label_nl: "Mijn weekend", label_en: "My weekend", description: "" },
    { key: "hobby", label_nl: "Mijn hobby", label_en: "My hobby", description: "" },
    { key: "buurt", label_nl: "Mijn buurt", label_en: "My neighbourhood", description: "" },
    { key: "dagelijkse_routine", label_nl: "Dagelijkse routine", label_en: "Daily routine", description: "" },
    { key: "vakantie", label_nl: "Vakantie", label_en: "Holiday", description: "" },
  ],
  formulier: [
    { key: "sportschool", label_nl: "Sportschool aanmelden", label_en: "Gym registration", description: "" },
    { key: "ingebroken", label_nl: "Aangifte inbraak", label_en: "Burglary report", description: "" },
    { key: "problemen_straat", label_nl: "Melding problemen straat", label_en: "Street problem report", description: "" },
    { key: "cursus_aanmelden", label_nl: "Cursus aanmelden", label_en: "Course registration", description: "" },
    { key: "bibliotheek", label_nl: "Bibliotheek inschrijven", label_en: "Library registration", description: "" },
  ],
  briefje: [
    { key: "bericht_collega", label_nl: "Bericht aan collega", label_en: "Note to colleague", description: "" },
    { key: "bericht_buren", label_nl: "Bericht aan buren", label_en: "Note to neighbours", description: "" },
    { key: "bericht_familie", label_nl: "Bericht aan familie", label_en: "Note to family", description: "" },
  ],
};
