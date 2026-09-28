import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { listTypes } from "../../api/assets";
import type { AssetType, FieldDef } from "../../api/types";
import DynamicFields from "../../components/DynamicFields";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { BigButton, Card, EmptyState, ErrorBox, Field, inputClass, Loading, PageHeader } from "../../components/ui";
import { errorMessage, fieldErrors } from "../../lib/format";
import { typeIcon } from "../../lib/status";
import { useApi } from "../../lib/useApi";

const ICONS = ["lightbulb", "droplet", "zap", "building", "droplets", "box", "mapPin", "plug"];

type Row = FieldDef & { optionsText: string };

// "Pump capacity (HP)" -> "pump_capacity_hp"
const toKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f_$1") || "field";

function TypeForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [interval, setInterval] = useState("180");
  const [icon, setIcon] = useState("box");
  const [rows, setRows] = useState<Row[]>([]);
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errs = fieldErrors(error);

  const fields: FieldDef[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    type: r.type,
    required: r.required,
    options: r.type === "select" ? r.optionsText.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
  }));

  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setRows(next);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api<AssetType>("/api/asset-types", {
        body: { name: name.trim(), codePrefix: prefix, icon, maintenanceIntervalDays: interval ? Number(interval) : undefined, fields },
      });
      toast("success", t("types.saved"));
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="grid gap-4 lg:grid-cols-2"
    >
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{t("types.new")}</h2>
        <Field label={t("types.name")} error={errs.name}>
          {(id) => <input id={id} required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("types.namePlaceholder")} className={inputClass} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("types.prefix")} error={errs.codePrefix}>
            {(id) => (
              <input
                id={id}
                required
                maxLength={4}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                placeholder="HP"
                className={`${inputClass} font-mono uppercase`}
              />
            )}
          </Field>
          <Field label={t("types.interval")} error={errs.maintenanceIntervalDays}>
            {(id) => <input id={id} type="number" min={1} inputMode="numeric" value={interval} onChange={(e) => setInterval(e.target.value)} className={inputClass} />}
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1 font-semibold">{t("types.icon")}</legend>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                aria-label={ic}
                aria-pressed={icon === ic}
                onClick={() => setIcon(ic)}
                className={`flex h-12 w-12 items-center justify-center rounded-xl ring-2 ring-inset ${icon === ic ? "bg-blue-800 text-white ring-blue-800" : "bg-white ring-gray-300"}`}
              >
                <Icon name={ic} className="h-6 w-6" />
              </button>
            ))}
          </div>
        </fieldset>

        <h3 className="font-bold">{t("types.fields")}</h3>
        {rows.length === 0 && <p className="text-gray-600">{t("types.noFields")}</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
            <Field label={`${t("types.fieldLabel")} ${i + 1}`} error={errs[`fields.${i}.label`] ?? errs[`fields.${i}.key`]} hint={`${t("types.fieldKey")}: ${r.key || "—"}`}>
              {(id, d) => <input id={id} aria-describedby={d} required value={r.label} onChange={(e) => update(i, { label: e.target.value, key: toKey(e.target.value) })} className={inputClass} />}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("types.fieldType")}>
                {(id) => (
                  <select id={id} value={r.type} onChange={(e) => update(i, { type: e.target.value as FieldDef["type"] })} className={inputClass}>
                    {(["text", "number", "date", "select"] as const).map((ft) => (
                      <option key={ft} value={ft}>
                        {t(`types.fieldTypes.${ft}`)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <label className="flex min-h-12 items-center gap-3 self-end font-semibold">
                <input type="checkbox" className="h-6 w-6" checked={r.required} onChange={(e) => update(i, { required: e.target.checked })} />
                {t("types.requiredField")}
              </label>
            </div>
            {r.type === "select" && (
              <Field label={t("types.options")} error={errs[`fields.${i}.options`]}>
                {(id) => <input id={id} required value={r.optionsText} onChange={(e) => update(i, { optionsText: e.target.value })} placeholder="LED, Sodium" className={inputClass} />}
              </Field>
            )}
            <div className="flex flex-wrap gap-2">
              <BigButton variant="ghost" icon="chevronLeft" className="[&>svg]:rotate-90" disabled={i === 0} onClick={() => move(i, -1)}>
                {t("types.moveUp")}
              </BigButton>
              <BigButton variant="ghost" icon="chevronRight" className="[&>svg]:rotate-90" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                {t("types.moveDown")}
              </BigButton>
              <BigButton variant="ghost" icon="trash" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                {t("types.remove")}
              </BigButton>
            </div>
          </div>
        ))}
        <BigButton variant="secondary" icon="plus" onClick={() => setRows([...rows, { key: "", label: "", type: "text", required: false, optionsText: "" }])}>
          {t("types.addField")}
        </BigButton>
        {error != null && <ErrorBox message={errorMessage(error)} />}
        <div className="flex flex-wrap gap-2">
          <BigButton type="submit" icon="check" disabled={busy}>
            {busy ? t("common.loading") : t("common.save")}
          </BigButton>
          <BigButton variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </BigButton>
        </div>
      </Card>

      {/* Live preview: exactly the form staff will see when adding this type */}
      <Card className="flex flex-col gap-4 self-start">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon name={icon} /> {t("types.preview")}: {name || "…"}
        </h2>
        {fields.length === 0 ? <p className="text-gray-600">{t("types.noFields")}</p> : <DynamicFields fields={fields.filter((f) => f.label)} values={preview} onChange={setPreview} />}
      </Card>
    </form>
  );
}

export default function AssetTypes() {
  const { t } = useTranslation();
  const types = useApi(listTypes, []);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={t("types.title")}
        actions={
          !creating && (
            <BigButton icon="plus" onClick={() => setCreating(true)}>
              {t("types.new")}
            </BigButton>
          )
        }
      />
      {creating && (
        <div className="mb-6">
          <TypeForm
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              types.reload();
            }}
          />
        </div>
      )}
      {types.error ? (
        <ErrorBox message={errorMessage(types.error)} onRetry={types.reload} />
      ) : !types.data ? (
        <Loading />
      ) : types.data.items.length === 0 ? (
        <EmptyState icon="layers" message={t("common.nothingHere")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {types.data.items.map((ty) => (
            <li key={ty.id}>
              <Card>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Icon name={typeIcon(ty.icon)} className="h-6 w-6" /> {ty.name}
                  <span className="font-mono text-sm text-gray-600">{ty.codePrefix}</span>
                </h2>
                <p className="text-gray-700">{t("types.assetCount", { count: ty._count?.assets ?? 0 })}</p>
                <ul className="mt-2 list-inside list-disc text-sm text-gray-700">
                  {ty.fields.map((f) => (
                    <li key={f.key}>
                      {f.label} · {t(`types.fieldTypes.${f.type}`)}
                      {f.required && ` · ${t("common.required")}`}
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
