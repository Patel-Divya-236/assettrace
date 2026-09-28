import { describe, expect, it } from "vitest";
import { AppError } from "./AppError";
import { type FieldDef, validateAttributes } from "./attributes";

const fields: FieldDef[] = [
  { key: "pump_capacity_hp", label: "Capacity (HP)", type: "number", required: true },
  { key: "installed_on", label: "Installed on", type: "date", required: false },
  { key: "source", label: "Water source", type: "select", required: true, options: ["Borewell", "River"] },
  { key: "notes", label: "Notes", type: "text", required: false },
];

// Returns the field -> message map from the thrown AppError.
function problemsOf(input: unknown) {
  try {
    validateAttributes(fields, input);
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("INVALID_ATTRIBUTES");
    return (err as AppError).details?.fields as Record<string, string>;
  }
  throw new Error("expected validateAttributes to throw");
}

describe("validateAttributes", () => {
  it("accepts valid input and cleans it", () => {
    const result = validateAttributes(fields, {
      pump_capacity_hp: "7.5",
      installed_on: "2024-03-31",
      source: "Borewell",
      notes: "  near school ",
    });
    expect(result).toEqual({
      pump_capacity_hp: 7.5,
      installed_on: "2024-03-31T00:00:00.000Z",
      source: "Borewell",
      notes: "near school",
    });
  });

  it("drops empty optional fields", () => {
    expect(validateAttributes(fields, { pump_capacity_hp: 5, source: "River", notes: "" })).toEqual({
      pump_capacity_hp: 5,
      source: "River",
    });
  });

  it("reports a missing required field", () => {
    expect(problemsOf({ source: "River" })).toHaveProperty("pump_capacity_hp");
  });

  it("reports a value that is not a number", () => {
    expect(problemsOf({ pump_capacity_hp: "five", source: "River" })).toHaveProperty("pump_capacity_hp");
  });

  it("reports a bad date", () => {
    expect(problemsOf({ pump_capacity_hp: 5, source: "River", installed_on: "31/31/2024" })).toHaveProperty(
      "installed_on",
    );
  });

  it("reports an invalid select option", () => {
    expect(problemsOf({ pump_capacity_hp: 5, source: "Lake" })).toHaveProperty("source");
  });

  it("reports an unknown key", () => {
    expect(problemsOf({ pump_capacity_hp: 5, source: "River", colour: "red" })).toHaveProperty("colour");
  });

  it("lists every problem at once", () => {
    const problems = problemsOf({ colour: "red" });
    expect(Object.keys(problems).sort()).toEqual(["colour", "pump_capacity_hp", "source"]);
  });
});
