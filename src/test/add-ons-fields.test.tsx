import { describe, expect, it } from "vitest";
import {
  ADD_ON_FIELDS,
  addonPayloadForBackend,
  requireServiceIdWhenScopedToOne,
} from "@/features/admin/screens/operations/AddOnsPage";

const CANONICAL_KEYS = [
  "title",
  "price",
  "currency",
  "isAvailable",
  "serviceId",
  "description",
  "addon_key",
];

const LEGACY_KEYS = ["price_minor", "display_name", "is_active"];

describe("AddOnsPage field vocabulary", () => {
  it("only uses keys from the canonical AddOnCreate set, plus UI-only addonScope", () => {
    for (const field of ADD_ON_FIELDS) {
      if (field.key === "addonScope") continue;
      expect(CANONICAL_KEYS).toContain(field.key);
    }
  });

  it("does not contain the legacy keys that caused free add-ons", () => {
    const keys = ADD_ON_FIELDS.map((f) => f.key);
    for (const legacyKey of LEGACY_KEYS) {
      expect(keys).not.toContain(legacyKey);
    }
  });

  it("price is a required money field", () => {
    const field = ADD_ON_FIELDS.find((f) => f.key === "price");
    expect(field?.type).toBe("money");
    expect(field?.required).toBe(true);
  });

  it("serviceId has help text warning that leaving it empty makes the add-on global", () => {
    const field = ADD_ON_FIELDS.find((f) => f.key === "serviceId");
    expect(field?.helpText?.toLowerCase()).toContain("global");
  });

  it("has a UI-only addonScope radio field with all/one options, required", () => {
    const field = ADD_ON_FIELDS.find((f) => f.key === "addonScope");
    expect(field?.type).toBe("radio");
    expect(field?.required).toBe(true);
    expect(field?.options?.map((o) => o.value).sort()).toEqual(["all", "one"]);
  });
});

describe("requireServiceIdWhenScopedToOne", () => {
  it("blocks submit when scope is one service but no serviceId is set", () => {
    expect(
      requireServiceIdWhenScopedToOne({ addonScope: "one", serviceId: "" }),
    ).toBeTruthy();
  });

  it("allows submit when scope is one service and serviceId is set", () => {
    expect(
      requireServiceIdWhenScopedToOne({ addonScope: "one", serviceId: "abc123" }),
    ).toBeNull();
  });

  it("allows submit when scope is all services regardless of serviceId", () => {
    expect(
      requireServiceIdWhenScopedToOne({ addonScope: "all", serviceId: "" }),
    ).toBeNull();
  });

  it("blocks submit when no scope has been chosen yet", () => {
    expect(requireServiceIdWhenScopedToOne({ addonScope: "", serviceId: "" })).toBeTruthy();
  });
});

describe("addonPayloadForBackend", () => {
  it("strips the UI-only addonScope key from the payload", () => {
    const payload = addonPayloadForBackend({
      addonScope: "one",
      serviceId: "svc-1",
      title: "Window Cleaning",
      price: 25,
    });
    expect(payload).not.toHaveProperty("addonScope");
  });

  it("produces a payload with no serviceId when scope is 'all services'", () => {
    const payload = addonPayloadForBackend({
      addonScope: "all",
      serviceId: "svc-1",
      title: "Window Cleaning",
      price: 25,
    });
    expect(payload).not.toHaveProperty("serviceId");
  });

  it("keeps serviceId when scope is 'one service'", () => {
    const payload = addonPayloadForBackend({
      addonScope: "one",
      serviceId: "svc-1",
      title: "Window Cleaning",
      price: 25,
    });
    expect(payload.serviceId).toBe("svc-1");
  });
});
