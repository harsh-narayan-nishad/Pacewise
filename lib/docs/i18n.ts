import type { DocsLang } from "@/lib/docs/lang";

/** Words used by the docs pages' own chrome (menu, buttons, headings). The documents themselves have their own Hindi files. */
const STRINGS = {
  en: {
    openMenu: "Open menu", closeMenu: "Close menu", menuLabel: "Notes and documents", navLabel: "Notes navigation",
    language: "Language", syllabus: "Syllabus", documents: "Documents", research: "Research", interview: "Interview",
    overview: "Overview", coreCse: "Core CSE", open: "Open",
    onThisPage: "On this page", minRead: "min read", previous: "Previous", next: "Next", breadcrumb: "Breadcrumb",
    notesTitle: "Notes", notesIntro: "How CN, OS, OOP and DBMS are used in", sharedBy: "Shared by",
    documentsTitle: "Documents", documentsIntro: "Every document of the project as a web page. Use the menu, or pick one below.", read: "Read",
    usedHere: "Used here: ", tradeoff: "Tradeoff: ", searchDocs: "Search docs", searchAria: "Search everything in the documents",
    notTranslated: "",
  },
  hi: {
    openMenu: "मेन्यू खोलें", closeMenu: "मेन्यू बंद करें", menuLabel: "नोट्स और दस्तावेज़", navLabel: "नोट्स नेविगेशन",
    language: "भाषा", syllabus: "सिलेबस", documents: "दस्तावेज़", research: "रिसर्च", interview: "इंटरव्यू",
    overview: "ओवरव्यू", coreCse: "कोर CSE", open: "खोलें",
    onThisPage: "इस पेज पर", minRead: "मिनट पढ़ने का समय", previous: "पिछला", next: "अगला", breadcrumb: "ब्रेडक्रम्ब",
    notesTitle: "नोट्स", notesIntro: "CN, OS, OOP और DBMS का उपयोग इसमें कैसे होता है:", sharedBy: "शेयर किया:",
    documentsTitle: "दस्तावेज़", documentsIntro: "प्रोजेक्ट का हर दस्तावेज़ एक वेब पेज के रूप में। मेन्यू इस्तेमाल करें, या नीचे से चुनें।", read: "पढ़ें",
    usedHere: "यहाँ उपयोग: ", tradeoff: "ट्रेडऑफ़: ", searchDocs: "दस्तावेज़ खोजें", searchAria: "सभी दस्तावेज़ों में खोजें",
    notTranslated: "यह पेज अभी हिंदी में उपलब्ध नहीं है, इसलिए अंग्रेज़ी में दिखाया गया है।",
  },
} as const;

export type UiKey = keyof (typeof STRINGS)["en"];
export const ui = (lang: DocsLang, key: UiKey): string => STRINGS[lang][key];

/** Hindi names for the folders (the English names live in lib/docs/library.ts). */
export const FOLDER_LABELS_HI: Record<string, string> = {
  "": "प्रोजेक्ट दस्तावेज़",
  interview: "इंटरव्यू तैयारी",
  research: "रिसर्च",
  syllabus: "सिलेबस",
  "system-design": "केस स्टडी",
  "leadership-principles": "लीडरशिप सिद्धांत",
  "leadership-principles/amazon": "Amazon की लीडरशिप",
  "leadership-principles/google": "Google की लीडरशिप",
  "leadership-principles/uber": "Uber की लीडरशिप",
  "leadership-principles/netflix": "Netflix की लीडरशिप",
  "leadership-principles/apple": "Apple की लीडरशिप",
  "daa-notes": "DAA नोट्स",
  "flip-book": "फ्लिप बुक इंजीनियरिंग",
  "syllabus/03-methodologies": "मेथडोलॉजी",
  "syllabus/04-core-cse": "कोर CSE",
  "syllabus/04-core-cse/cn": "CN",
  "syllabus/04-core-cse/os": "OS",
  "syllabus/04-core-cse/dbms": "DBMS",
  "syllabus/04-core-cse/oops": "OOPs",
  "syllabus/06-system-design": "सिस्टम डिज़ाइन",
};
