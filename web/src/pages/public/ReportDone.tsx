import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import Icon from "../../components/Icon";

export default function ReportDone() {
  const { t } = useTranslation();
  const { trackingCode = "" } = useParams();
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Icon name="checkCircle" className="h-20 w-20 text-green-700" />
      <h1 className="text-2xl font-bold">{t("done.title")}</h1>
      <div className="w-full rounded-2xl bg-white p-5 ring-2 ring-blue-800">
        <p className="text-lg text-gray-700">{t("done.number")}</p>
        {/* Very large, spaced digits so they are easy to copy onto paper */}
        <p className="font-mono text-5xl font-bold tracking-[0.2em] text-blue-900" aria-label={trackingCode.split("").join(" ")}>
          {trackingCode}
        </p>
      </div>
      <p className="text-lg font-semibold">{t("done.writeDown")}</p>
      <Link to={`/track?code=${trackingCode}`} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-blue-800 text-xl font-bold text-white">
        <Icon name="search" className="h-7 w-7" /> {t("done.track")}
      </Link>
      <Link to="/" className="min-h-12 content-center text-lg text-blue-900 underline">
        {t("done.home")}
      </Link>
    </div>
  );
}
