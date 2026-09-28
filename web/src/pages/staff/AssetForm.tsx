import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { createAsset, getAsset, listTypes, updateAsset } from "../../api/assets";
import type { AssetType } from "../../api/types";
import DynamicFields, { toAttributes } from "../../components/DynamicFields";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { BigButton, Card, ErrorBox, Field, inputClass, Loading, PageHeader, Skeleton } from "../../components/ui";
import { errorMessage, fieldErrors } from "../../lib/format";
import { typeIcon } from "../../lib/status";
import { useApi } from "../../lib/useApi";

const LocationPicker = lazy(() => import("../../components/LocationPicker"));

type Step = "type" | "details" | "location" | "confirm";

/** Add asset wizard: Type -> Details -> Location -> Confirm. Edit reuses Details + Location. */
export default function AssetForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const editing = !!id;
  const steps: Step[] = editing ? ["details", "location", "confirm"] : ["type", "details", "location", "confirm"];

  const types = useApi(listTypes, []);
  const existing = useApi(() => (id ? getAsset(id) : Promise.resolve(null)), [id]);
  const [step, setStep] = useState<Step>(steps[0]);
  const [type, setType] = useState<AssetType | null>(null);
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();
  const [locationText, setLocationText] = useState("");
  const [ward, setWard] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [locating, setLocating] = useState(false);
  const errs = fieldErrors(error);

  // Fill the form when editing.
  useEffect(() => {
    const a = existing.data;
    if (!a) return;
    setType(a.type);
    setName(a.name);
    setCondition(a.condition ? String(a.condition) : "");
    setValues(Object.fromEntries(Object.entries(a.attributes).map(([k, v]) => [k, a.type.fields.find((f) => f.key === k)?.type === "date" ? String(v).slice(0, 10) : String(v)])));
    setLat(a.lat);
    setLng(a.lng);
    setLocationText(a.locationText);
    setWard(a.ward ?? "");
  }, [existing.data]);

  const index = steps.indexOf(step);
  const next = () => setStep(steps[index + 1]);
  const back = () => (index === 0 ? navigate(-1) : setStep(steps[index - 1]));

  function useMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast("error", t("errors.LOCATION_DENIED"));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function save() {
    if (!type || lat === undefined || lng === undefined) return;
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      lat,
      lng,
      locationText: locationText.trim(),
      ward: ward.trim() || undefined,
      attributes: toAttributes(type.fields, values),
      condition: condition ? Number(condition) : undefined,
    };
    try {
      const saved = editing ? await updateAsset(id!, body) : await createAsset({ ...body, typeId: type.id });
      toast("success", editing ? t("asset.saved") : t("wizard.created", { code: saved.assetCode }));
      navigate(`/app/assets/${saved.id}`);
    } catch (err) {
      setError(err);
      // Send the user back to the step with the problem.
      const f = fieldErrors(err);
      if (Object.keys(f).some((k) => ["lat", "lng", "locationText", "ward"].includes(k))) setStep("location");
      else if (Object.keys(f).length) setStep("details");
    } finally {
      setBusy(false);
    }
  }

  if (editing && !existing.data) return existing.error ? <ErrorBox message={errorMessage(existing.error)} /> : <Loading />;

  return (
    <>
      <PageHeader title={editing ? `${t("wizard.editTitle")}: ${existing.data?.assetCode}` : t("wizard.title")} />

      {/* Step indicator */}
      <ol className="mb-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
        {steps.map((s, i) => (
          <li key={s} aria-current={s === step ? "step" : undefined} className={`rounded-lg px-2 py-2 text-center text-sm font-semibold ${i < index ? "bg-green-100 text-green-900" : s === step ? "bg-blue-800 text-white" : "bg-gray-100 text-gray-600"}`}>
            {i + 1}. {t(`wizard.steps.${s}`)}
          </li>
        ))}
      </ol>

      <Card className="flex flex-col gap-4">
        {step === "type" && (
          <>
            <h2 className="text-xl font-bold">{t("wizard.chooseType")}</h2>
            {!types.data ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {types.data.items.map((ty) => (
                  <button
                    key={ty.id}
                    type="button"
                    onClick={() => {
                      if (type?.id !== ty.id) setValues({});
                      setType(ty);
                      next();
                    }}
                    className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl p-4 text-lg font-bold ring-2 ring-inset hover:bg-blue-50 ${type?.id === ty.id ? "ring-blue-800" : "ring-gray-300"}`}
                  >
                    <Icon name={typeIcon(ty.icon)} className="h-10 w-10 text-blue-900" />
                    {ty.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === "details" && type && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Icon name={typeIcon(type.icon)} /> {type.name}
            </h2>
            <Field label={t("wizard.name")} error={errs.name}>
              {(fid) => <input id={fid} required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("wizard.namePlaceholder")} className={inputClass} />}
            </Field>
            <DynamicFields fields={type.fields} values={values} onChange={setValues} errors={errs} />
            <Field label={`${t("wizard.condition")} (${t("common.optional")})`}>
              {(fid) => (
                <select id={fid} value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {[5, 4, 3, 2, 1].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Nav onBack={back} submit />
          </form>
        )}

        {step === "location" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (lat === undefined) toast("error", t("wizard.needLocation"));
              else next();
            }}
          >
            <BigButton variant="secondary" icon="mapPin" onClick={useMyLocation} disabled={locating}>
              {locating ? t("common.loading") : t("wizard.useMyLocation")}
            </BigButton>
            <p className="text-gray-700">{t("wizard.tapMap")}</p>
            <Suspense fallback={<Skeleton className="h-72" />}>
              <LocationPicker
                lat={lat}
                lng={lng}
                onPick={(la, ln) => {
                  setLat(la);
                  setLng(ln);
                }}
              />
            </Suspense>
            {lat !== undefined && lng !== undefined && (
              <p className="font-mono text-sm text-gray-700">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            )}
            <Field label={t("wizard.locationText")} error={errs.locationText}>
              {(fid) => <input id={fid} required minLength={2} value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder={t("wizard.locationPlaceholder")} className={inputClass} />}
            </Field>
            <Field label={`${t("wizard.ward")} (${t("common.optional")})`}>
              {(fid) => <input id={fid} value={ward} onChange={(e) => setWard(e.target.value)} className={inputClass} />}
            </Field>
            <Nav onBack={back} submit />
          </form>
        )}

        {step === "confirm" && type && (
          <>
            <h2 className="text-xl font-bold">{t("wizard.steps.confirm")}</h2>
            <dl className="grid gap-2">
              {[
                [t("assets.type"), type.name],
                [t("wizard.name"), name],
                ...type.fields.map((f) => [f.label, values[f.key] || "—"]),
                [t("asset.condition"), condition || "—"],
                [t("wizard.locationText"), locationText],
                [t("wizard.ward"), ward || "—"],
                [t("asset.coordinates"), lat !== undefined ? `${lat.toFixed(5)}, ${lng!.toFixed(5)}` : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col border-b border-gray-100 pb-2 sm:flex-row sm:gap-4">
                  <dt className="font-semibold text-gray-600 sm:w-56">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {error != null && <ErrorBox message={errorMessage(error)} />}
            <div className="flex flex-wrap gap-2">
              <BigButton variant="secondary" icon="arrowLeft" onClick={back}>
                {t("common.back")}
              </BigButton>
              <BigButton icon="check" big onClick={save} disabled={busy}>
                {busy ? t("common.loading") : editing ? t("common.save") : t("wizard.create")}
              </BigButton>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function Nav({ onBack, submit }: { onBack: () => void; submit?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      <BigButton variant="secondary" icon="arrowLeft" onClick={onBack}>
        {t("common.back")}
      </BigButton>
      <BigButton type={submit ? "submit" : "button"}>
        {t("common.next")} <Icon name="chevronRight" />
      </BigButton>
    </div>
  );
}
