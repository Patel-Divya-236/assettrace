import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";
import { listTypes } from "../../api/assets";
import { api } from "../../api/client";
import { ASSET_STATUSES, type AssetStatus } from "../../api/types";
import { GANDHINAGAR } from "../../components/LocationPicker";
import { Field, inputClass, PageHeader, StatusBadge } from "../../components/ui";
import { STATUS_HEX } from "../../lib/status";
import { useApi } from "../../lib/useApi";

type Dot = { id: string; assetCode: string; typeId: string; status: AssetStatus; lat: number; lng: number };
type MapResult = { items: Dot[]; capped: boolean; limit: number };

/** Calls onMove with the visible box 300 ms after the map stops moving. */
function BoundsWatcher({ onMove }: { onMove: (bbox: string) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const map = useMapEvents({
    moveend: () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => onMove(map.getBounds().toBBoxString()), 300);
    },
  });
  useEffect(() => onMove(map.getBounds().toBBoxString()), [map, onMove]);
  return null;
}

export default function MapPage() {
  const { t } = useTranslation();
  const types = useApi(listTypes, []);
  const [typeId, setTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [bbox, setBbox] = useState<string | null>(null);
  const [data, setData] = useState<MapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const onMove = useCallback((b: string) => setBbox(b), []);
  const typeName = (id: string) => types.data?.items.find((ty) => ty.id === id)?.name ?? "";

  useEffect(() => {
    if (!bbox) return;
    let current = true;
    setLoading(true);
    api<MapResult>("/api/assets/map", { query: { bbox, typeId, status } })
      .then((d) => current && setData(d))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [bbox, typeId, status]);

  return (
    <>
      <PageHeader title={t("map.title")} />
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Field label={t("assets.type")}>
          {(id) => (
            <select id={id} value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClass}>
              <option value="">{t("common.all")}</option>
              {types.data?.items.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {ty.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("assets.status")}>
          {(id) => (
            <select id={id} value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">{t("common.all")}</option>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}.label`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <p className="mb-2 min-h-6 text-base font-semibold text-amber-900" aria-live="polite">
        {loading ? t("map.loading") : data?.capped ? t("map.capped", { limit: data.limit }) : ""}
      </p>
      <MapContainer center={GANDHINAGAR} zoom={14} preferCanvas className="h-[60vh] w-full rounded-2xl ring-1 ring-gray-300">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <BoundsWatcher onMove={onMove} />
        {data?.items.map((d) => (
          <CircleMarker key={d.id} center={[d.lat, d.lng]} radius={6} pathOptions={{ color: "#fff", weight: 1, fillColor: STATUS_HEX[d.status], fillOpacity: 0.9 }}>
            <Popup>
              <div className="flex flex-col gap-2 text-base">
                <strong className="font-mono">{d.assetCode}</strong>
                <span>{typeName(d.typeId)}</span>
                <StatusBadge status={d.status} />
                <Link to={`/app/assets/${d.id}`} className="font-bold text-blue-900 underline">
                  {t("common.open")}
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {/* Legend: colour + icon + word */}
      <h2 className="mt-4 mb-2 font-bold">{t("map.legend")}</h2>
      <ul className="flex flex-wrap gap-2">
        {ASSET_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="h-4 w-4 rounded-full" style={{ background: STATUS_HEX[s] }} aria-hidden="true" />
            <StatusBadge status={s} />
          </li>
        ))}
      </ul>
    </>
  );
}
