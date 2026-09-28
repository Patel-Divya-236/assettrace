import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { getNearby } from "../../api/public";
import type { PublicAsset } from "../../api/types";
import Icon from "../../components/Icon";
import { BigButton, EmptyState, ErrorBox, StatusBadge } from "../../components/ui";
import { errorMessage } from "../../lib/format";
import { typeIcon } from "../../lib/status";

export default function Nearby() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PublicAsset[] | null>(null);
  const [state, setState] = useState<"idle" | "locating" | "denied">("idle");
  const [error, setError] = useState<unknown>(null);

  function locate() {
    setState("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          setItems((await getNearby(p.coords.latitude, p.coords.longitude)).items);
        } catch (err) {
          setError(err);
        }
        setState("idle");
      },
      () => setState("denied"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  const distance = (m: number) => (m < 1000 ? t("nearby.away", { meters: m }) : t("nearby.awayKm", { km: (m / 1000).toFixed(1) }));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">{t("nearby.title")}</h1>
      {items === null && (
        <>
          <p className="text-lg">{t("nearby.askHelp")}</p>
          <BigButton big icon="mapPin" onClick={locate} disabled={state === "locating"} className="min-h-16 text-xl">
            {state === "locating" ? t("nearby.finding") : t("nearby.ask")}
          </BigButton>
        </>
      )}
      {state === "denied" && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 text-lg text-amber-950 ring-1 ring-amber-300">
          <p className="flex items-center gap-2 font-bold">
            <Icon name="alert" className="h-7 w-7" /> {t("errors.LOCATION_DENIED")}
          </p>
          <BigButton variant="secondary" onClick={locate}>
            {t("common.retry")}
          </BigButton>
        </div>
      )}
      {error != null && <ErrorBox message={errorMessage(error)} onRetry={locate} />}
      {items && items.length === 0 && <EmptyState icon="mapPin" message={t("nearby.none")} />}
      {items && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.assetCode}>
              <Link to={`/a/${a.assetCode}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200 active:bg-blue-50">
                <Icon name={typeIcon(a.type.icon)} className="h-9 w-9 text-blue-900" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="font-bold">
                    {a.type.name} · <span className="font-mono">{a.assetCode}</span>
                  </p>
                  <p className="truncate text-base text-gray-700">{a.locationText}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="public" status={a.publicStatus} />
                    <span className="text-base font-semibold text-gray-800">{distance(a.distanceMeters ?? 0)}</span>
                  </div>
                </div>
                <Icon name="chevronRight" className="h-6 w-6 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
