import { describe, expect, it } from "vitest";
import { SERVICE_DEFINITION_FIELDS } from "@/features/admin/screens/operations/ServiceDefinitionsPage";

const CANONICAL_KEYS = [
  "title",
  "description",
  "basePrice",
  "hourlyRate",
  "minimumHours",
  "maximumHours",
  "hourIncrement",
  "priceUnit",
  "currency",
  "isAvailable",
  "checklist",
  "service_key",
];

const LEGACY_KEYS = ["display_name", "is_active", "base_duration_minutes"];

describe("ServiceDefinitionsPage field vocabulary", () => {
  it("only uses keys from the canonical ServiceDefinitionCreate set", () => {
    for (const field of SERVICE_DEFINITION_FIELDS) {
      expect(CANONICAL_KEYS).toContain(field.key);
    }
  });

  it("does not contain the legacy keys that nothing reads", () => {
    const keys = SERVICE_DEFINITION_FIELDS.map((f) => f.key);
    for (const legacyKey of LEGACY_KEYS) {
      expect(keys).not.toContain(legacyKey);
    }
  });

  it("priceUnit is a radio field with exactly HOURLY and FLAT options", () => {
    const field = SERVICE_DEFINITION_FIELDS.find((f) => f.key === "priceUnit");
    expect(field?.type).toBe("radio");
    expect(field?.options?.map((o) => o.value).sort()).toEqual(["FLAT", "HOURLY"]);
  });

  it("basePrice and hourlyRate are money fields", () => {
    const basePrice = SERVICE_DEFINITION_FIELDS.find((f) => f.key === "basePrice");
    const hourlyRate = SERVICE_DEFINITION_FIELDS.find((f) => f.key === "hourlyRate");
    expect(basePrice?.type).toBe("money");
    expect(hourlyRate?.type).toBe("money");
  });

  it("checklist is an array_csv field with help text", () => {
    const field = SERVICE_DEFINITION_FIELDS.find((f) => f.key === "checklist");
    expect(field?.type).toBe("array_csv");
    expect(field?.helpText).toBeTruthy();
  });
});
