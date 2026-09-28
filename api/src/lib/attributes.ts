import { AppError } from "./AppError";

// One custom field as defined by an admin on an asset type.
export type FieldType = "text" | "number" | "date" | "select";
export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
};

export type Attributes = Record<string, string | number>;

const isEmpty = (v: unknown) => v === undefined || v === null || v === "";

/**
 * Checks asset attributes against the type's field definitions.
 * Returns cleaned values (numbers as numbers, dates as ISO strings, text trimmed,
 * empty optional values removed) or throws one AppError listing every problem.
 */
export function validateAttributes(fields: FieldDef[], input: unknown): Attributes {
  if (input !== undefined && (typeof input !== "object" || input === null || Array.isArray(input))) {
    throw new AppError(400, "INVALID_ATTRIBUTES", "Custom fields must be an object.");
  }
  const values = (input ?? {}) as Record<string, unknown>;
  const problems: Record<string, string> = {};
  const clean: Attributes = {};
  const known = new Set(fields.map((f) => f.key));

  for (const key of Object.keys(values)) {
    if (!known.has(key)) problems[key] = "This field does not exist for this asset type.";
  }

  for (const field of fields) {
    const raw = values[field.key];

    if (isEmpty(raw)) {
      if (field.required) problems[field.key] = `${field.label} is required.`;
      continue;
    }

    switch (field.type) {
      case "text": {
        if (typeof raw !== "string") problems[field.key] = `${field.label} must be text.`;
        else clean[field.key] = raw.trim();
        break;
      }
      case "number": {
        // Accept 12 or "12" (CSV values arrive as strings).
        const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
        if (!Number.isFinite(n)) problems[field.key] = `${field.label} must be a number.`;
        else clean[field.key] = n;
        break;
      }
      case "date": {
        const d = typeof raw === "string" ? new Date(raw.trim()) : new Date(NaN);
        if (Number.isNaN(d.getTime())) {
          problems[field.key] = `${field.label} must be a valid date, for example 2024-03-31.`;
        } else clean[field.key] = d.toISOString();
        break;
      }
      case "select": {
        const options = field.options ?? [];
        if (typeof raw !== "string" || !options.includes(raw)) {
          problems[field.key] = `${field.label} must be one of: ${options.join(", ")}.`;
        } else clean[field.key] = raw;
        break;
      }
    }
  }

  if (Object.keys(problems).length > 0) {
    throw new AppError(400, "INVALID_ATTRIBUTES", "Some custom fields are missing or invalid.", {
      fields: problems,
    });
  }
  return clean;
}
