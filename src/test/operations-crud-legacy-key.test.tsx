import { describe, expect, it } from "vitest";
import {
  mapFormToPayload,
  mapItemToFormValues,
  type CrudField,
} from "@/features/admin/screens/operations/OperationsCrudPage";
import {
  ADD_ON_FIELDS,
  addonPayloadForBackend,
  addonScopeFromItem,
} from "@/features/admin/screens/operations/AddOnsPage";
import { SERVICE_DEFINITION_FIELDS } from "@/features/admin/screens/operations/ServiceDefinitionsPage";
import { PROMO_CODE_FIELDS } from "@/features/admin/screens/operations/PromoCodesPage";
import type { AdminResourceItem } from "@/lib/api/types";

// Finding 1: a legacy record (e.g. `is_active: true`, no `isAvailable`) must
// not render its availability toggle as OFF. Before this batch, `is_active`
// was inert, so an admin editing an unrelated typo and saving was harmless.
// Since `mapFormToPayload` always emits a boolean for a boolean field, a
// blank/false toggle now silently deactivates the record on save.
describe("CrudField.legacyKey fallback", () => {
  const FIELDS: CrudField[] = [
    { key: "isAvailable", label: "Available", type: "boolean", legacyKey: "is_active" },
    { key: "title", label: "Title", type: "text" },
  ];

  it("falls back to the legacy key when the canonical key is absent, and round-trips true", () => {
    const item = { id: "1", is_active: true, title: "Legacy Service" } as unknown as AdminResourceItem;
    const formValues = mapItemToFormValues(item, FIELDS);
    expect(formValues.isAvailable).toBe(true);

    const payload = mapFormToPayload(formValues, FIELDS);
    expect(payload.isAvailable).toBe(true);
  });

  it("prefers the canonical key when present, ignoring a disagreeing legacy key", () => {
    const item = { id: "1", is_active: true, isAvailable: false } as unknown as AdminResourceItem;
    const formValues = mapItemToFormValues(item, FIELDS);
    expect(formValues.isAvailable).toBe(false);
  });

  it("a field with no legacyKey behaves exactly as before (missing canonical -> falsy default)", () => {
    const noFallback: CrudField[] = [{ key: "isAvailable", label: "Available", type: "boolean" }];
    const item = { id: "1", is_active: true } as unknown as AdminResourceItem;
    const formValues = mapItemToFormValues(item, noFallback);
    expect(formValues.isAvailable).toBe(false);
  });
});

describe("legacyKey wiring on real field sets", () => {
  it("ServiceDefinitionsPage isAvailable falls back to is_active", () => {
    const field = SERVICE_DEFINITION_FIELDS.find((f) => f.key === "isAvailable");
    expect(field?.legacyKey).toBe("is_active");
  });

  it("AddOnsPage isAvailable falls back to is_active, and price has NO legacyKey (unit mismatch)", () => {
    const isAvailable = ADD_ON_FIELDS.find((f) => f.key === "isAvailable");
    const price = ADD_ON_FIELDS.find((f) => f.key === "price");
    expect(isAvailable?.legacyKey).toBe("is_active");
    expect(price?.legacyKey).toBeUndefined();
  });

  it("PromoCodesPage active falls back to is_active", () => {
    const field = PROMO_CODE_FIELDS.find((f) => f.key === "active");
    expect(field?.legacyKey).toBe("is_active");
  });
});

// Finding 3: un-scoping an add-on must actually clear serviceId server-side,
// and the "Applies To" radio must reflect the stored record on edit.
describe("AddOnsPage scope handling", () => {
  it("sends serviceId: null (not omitted) when un-scoping from one service to all", () => {
    const payload = addonPayloadForBackend({ addonScope: "all", serviceId: "svc-1", title: "X" });
    expect(payload).toHaveProperty("serviceId", null);
    expect(payload).not.toHaveProperty("addonScope");
  });

  it("sends the chosen serviceId when scoped to one service", () => {
    const payload = addonPayloadForBackend({ addonScope: "one", serviceId: "svc-1" });
    expect(payload.serviceId).toBe("svc-1");
  });

  it("derives addonScope 'one' when the stored record has a serviceId", () => {
    expect(addonScopeFromItem("svc-1")).toBe("one");
  });

  it("derives addonScope 'all' when the stored record has no serviceId", () => {
    expect(addonScopeFromItem(undefined)).toBe("all");
    expect(addonScopeFromItem(null)).toBe("all");
    expect(addonScopeFromItem("")).toBe("all");
  });
});
