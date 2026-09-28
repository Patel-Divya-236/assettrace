import { useTranslation } from "react-i18next";

// Placeholder: the full public home is built in P15.
export default function Home() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold text-blue-900">{t("public.homeTitle")}</h1>
      <p className="text-lg text-gray-800">{t("public.homeHelp")}</p>
    </div>
  );
}
