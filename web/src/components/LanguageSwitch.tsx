import { useTranslation } from "react-i18next";
import { LANGUAGES, setLanguage } from "../i18n";

/** ગુજરાતી | हिंदी | English, always visible. Each name is written in its own script. */
export default function LanguageSwitch({ big = false }: { big?: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <div role="group" aria-label={t("lang.label")} className="flex gap-1">
      {LANGUAGES.map((lang) => {
        const active = i18n.language === lang;
        return (
          <button
            key={lang}
            type="button"
            lang={lang}
            aria-pressed={active}
            onClick={() => setLanguage(lang)}
            className={`min-h-12 rounded-lg px-3 font-semibold ${big ? "text-lg" : "text-base"} ${
              active ? "bg-blue-800 text-white" : "bg-white text-blue-900 ring-1 ring-inset ring-blue-300 hover:bg-blue-50"
            }`}
          >
            {t(`lang.${lang}`)}
          </button>
        );
      })}
    </div>
  );
}
