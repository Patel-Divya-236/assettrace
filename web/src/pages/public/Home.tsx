import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import Icon from "../../components/Icon";
import LanguageSwitch from "../../components/LanguageSwitch";
import { BigButton, Field, inputClass } from "../../components/ui";
import { hasChosenLanguage } from "../../i18n";

const bigLink = "flex min-h-16 items-center gap-4 rounded-2xl bg-blue-800 px-5 text-xl font-bold text-white shadow hover:bg-blue-900";

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [firstVisit] = useState(() => !hasChosenLanguage());

  function openCode(e: FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) navigate(`/a/${c}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* First visit: language choice first, very large */}
      {firstVisit && (
        <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-2 ring-blue-200">
          <h2 className="text-xl font-bold">{t("lang.choose")}</h2>
          <LanguageSwitch big />
        </section>
      )}

      <div>
        <h1 className="text-3xl font-bold text-blue-900">{t("public.homeTitle")}</h1>
        <p className="mt-2 text-lg text-gray-800">{t("public.homeHelp")}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200">
          <p className="flex items-center gap-3 text-xl font-bold">
            <Icon name="qr" className="h-9 w-9 text-blue-900" /> {t("public.scan")}
          </p>
          <p className="mt-2 text-lg text-gray-800">{t("public.scanHelp")}</p>
        </div>
        <Link to="/nearby" className={bigLink}>
          <Icon name="mapPin" className="h-8 w-8" /> {t("public.nearby")}
        </Link>
        <Link to="/track" className={bigLink}>
          <Icon name="search" className="h-8 w-8" /> {t("public.track")}
        </Link>
      </div>

      <form onSubmit={openCode} className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
        <Field label={t("public.enterCode")}>
          {(id) => (
            <input id={id} value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("public.codePlaceholder")} autoCapitalize="characters" className={`${inputClass} min-h-14 font-mono text-xl uppercase`} />
          )}
        </Field>
        <BigButton type="submit" big variant="secondary">
          {t("public.go")}
        </BigButton>
      </form>

      <Link to="/login" className="min-h-12 self-center content-center text-base text-gray-700 underline">
        {t("public.staffLogin")}
      </Link>
    </div>
  );
}
