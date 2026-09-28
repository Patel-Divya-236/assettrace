import { useTranslation } from "react-i18next";
import type { FieldDef } from "../api/types";
import { Field, inputClass } from "./ui";

type Props = {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
};

/** Renders the form an admin defined for an asset type. Used by the wizard and the type preview. */
export default function DynamicFields({ fields, values, onChange, errors = {}, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <>
      {fields.map((f) => (
        <Field key={f.key} label={`${f.label}${f.required ? "" : ` (${t("common.optional")})`}`} error={errors[f.key] ?? errors[`attributes.${f.key}`]}>
          {(id, describedBy) =>
            f.type === "select" ? (
              <select
                id={id}
                aria-describedby={describedBy}
                required={f.required}
                disabled={disabled}
                value={values[f.key] ?? ""}
                onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                aria-describedby={describedBy}
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                step={f.type === "number" ? "any" : undefined}
                required={f.required}
                disabled={disabled}
                value={values[f.key] ?? ""}
                onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
                className={inputClass}
              />
            )
          }
        </Field>
      ))}
    </>
  );
}

/** Form strings -> API values (numbers as numbers, empty removed). */
export function toAttributes(fields: FieldDef[], values: Record<string, string>) {
  const out: Record<string, string | number> = {};
  for (const f of fields) {
    const v = values[f.key]?.trim();
    if (!v) continue;
    out[f.key] = f.type === "number" ? Number(v) : v;
  }
  return out;
}
