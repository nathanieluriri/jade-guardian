import { describe, expect, it } from "vitest";
import { PROMO_CODE_FIELDS } from "@/features/admin/screens/operations/PromoCodesPage";
import { SERVICE_AREA_FIELDS } from "@/features/admin/screens/operations/ServiceAreasPage";
import { PRICING_RULE_FIELDS } from "@/features/admin/screens/operations/PricingRulesPage";
import {
  mapFormToPayload,
  mapItemToFormValues,
} from "@/features/admin/screens/operations/OperationsCrudPage";
import type { AdminResourceItem } from "@/lib/api/types";

const PROMO_CANONICAL_KEYS = [
  "code",
  "title",
  "description",
  "discountType",
  "discountValue",
  "minimumSpend",
  "maximumDiscount",
  "currency",
  "startsAt",
  "expiresAt",
  "active",
  "maxRedemptions",
];

const PROMO_LEGACY_KEYS = [
  "discount_type",
  "discount_value",
  "is_active",
  "valid_from_epoch",
  "valid_to_epoch",
];

describe("PromoCodesPage field vocabulary", () => {
  it("only uses the canonical PromoCodeCreate keys", () => {
    const keys = PROMO_CODE_FIELDS.map((f) => f.key);
    for (const key of keys) {
      expect(PROMO_CANONICAL_KEYS).toContain(key);
    }
  });

  it("does not contain any legacy key", () => {
    const keys = PROMO_CODE_FIELDS.map((f) => f.key);
    for (const legacyKey of PROMO_LEGACY_KEYS) {
      expect(keys).not.toContain(legacyKey);
    }
  });

  it("discountType is a radio with exactly PERCENT and FIXED", () => {
    const field = PROMO_CODE_FIELDS.find((f) => f.key === "discountType");
    expect(field?.type).toBe("radio");
    expect(field?.options?.map((o) => o.value).sort()).toEqual(["FIXED", "PERCENT"]);
  });

  it("discountValue is a required number field", () => {
    const field = PROMO_CODE_FIELDS.find((f) => f.key === "discountValue");
    expect(field?.type).toBe("number");
    expect(field?.required).toBe(true);
  });

  it("startsAt and expiresAt are date fields", () => {
    expect(PROMO_CODE_FIELDS.find((f) => f.key === "startsAt")?.type).toBe("date");
    expect(PROMO_CODE_FIELDS.find((f) => f.key === "expiresAt")?.type).toBe("date");
  });

  it("minimumSpend and maximumDiscount are money fields", () => {
    expect(PROMO_CODE_FIELDS.find((f) => f.key === "minimumSpend")?.type).toBe("money");
    expect(PROMO_CODE_FIELDS.find((f) => f.key === "maximumDiscount")?.type).toBe("money");
  });

  it("code is required", () => {
    expect(PROMO_CODE_FIELDS.find((f) => f.key === "code")?.required).toBe(true);
  });
});

describe("ServiceAreasPage field vocabulary (unchanged names)", () => {
  it("keeps the existing snake_case field names", () => {
    const keys = SERVICE_AREA_FIELDS.map((f) => f.key);
    expect(keys).toEqual(
      expect.arrayContaining(["zone_code", "display_name", "zip_codes", "boundary_geojson", "is_active"]),
    );
  });
});

describe("PricingRulesPage field vocabulary (unchanged names)", () => {
  it("keeps the existing snake_case field names", () => {
    const keys = PRICING_RULE_FIELDS.map((f) => f.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "rule_name",
        "rule_type",
        "multiplier",
        "priority",
        "zone_codes",
        "day_of_week",
        "start_hour",
        "end_hour",
        "is_active",
      ]),
    );
  });

  it("rule_type is a select suggesting exactly the four backend enum values", () => {
    const field = PRICING_RULE_FIELDS.find((f) => f.key === "rule_type");
    expect(field?.type).toBe("select");
    expect(field?.options?.map((o) => o.value).sort()).toEqual(
      ["day_of_week", "demand", "time_window", "zone"].sort(),
    );
  });

  it("day_of_week is a multiselect of the seven days", () => {
    const field = PRICING_RULE_FIELDS.find((f) => f.key === "day_of_week");
    expect(field?.type).toBe("multiselect");
    expect(field?.options?.length).toBe(7);
  });

  it("a record whose rule_type is outside the suggestion list round-trips unchanged through edit", () => {
    const item: AdminResourceItem = {
      id: "rule-1",
      rule_name: "Legacy Rule",
      rule_type: "custom_legacy_thing",
      multiplier: 1.5,
      priority: 1,
    } as AdminResourceItem;

    const formValues = mapItemToFormValues(item, PRICING_RULE_FIELDS);
    expect(formValues.rule_type).toBe("custom_legacy_thing");

    const payload = mapFormToPayload(formValues, PRICING_RULE_FIELDS);
    expect(payload.rule_type).toBe("custom_legacy_thing");
  });
});
