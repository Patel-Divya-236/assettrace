import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import gu from "./gu.json";
import hi from "./hi.json";

export const LANGUAGES = ["gu", "hi", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
const STORAGE_KEY = "assettrace.lang";

// Saved choice first, then the phone's language, then English.
function initialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && (LANGUAGES as readonly string[]).includes(saved)) return saved as Language;
  const phone = navigator.language.slice(0, 2);
  return (LANGUAGES as readonly string[]).includes(phone) ? (phone as Language) : "en";
}

export const hasChosenLanguage = () => localStorage.getItem(STORAGE_KEY) !== null;

export function setLanguage(lang: Language) {
  localStorage.setItem(STORAGE_KEY, lang);
  void i18n.changeLanguage(lang);
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, gu: { translation: gu } },
  lng: initialLanguage(),
  fallbackLng: "en", // a missing Hindi/Gujarati string shows English, never a key
  interpolation: { escapeValue: false }, // React already escapes
});

// Screen readers and fonts need the right lang attribute.
document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
