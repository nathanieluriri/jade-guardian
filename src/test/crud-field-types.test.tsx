import { describe, expect, it } from "vitest";
import {
  mapFormToPayload,
  mapItemToFormValues,
  type CrudField,
} from "@/features/admin/screens/operations/OperationsCrudPage";
import type { AdminResourceItem } from "@/lib/api/types";

describe("OperationsCrudPage field type mapping", () => {
  it("maps money field to a number in major units, not a string or minor units", () => {
    const fields: CrudField[] = [{ key: "price", label: "Price", type: "money" }];
    const payload = mapFormToPayload({ price: "25.50" }, fields);
    expect(payload.price).toBe(25.5);
    expect(typeof payload.price).toBe("number");
  });

  it("round-trips date field: form value -> epoch seconds -> form value", () => {
    const fields: CrudField[] = [{ key: "startsAt", label: "Starts At", type: "date" }];
    const payload = mapFormToPayload({ startsAt: "2026-08-02" }, fields);
    expect(typeof payload.startsAt).toBe("number");
    // must be epoch SECONDS, not milliseconds
    expect(payload.startsAt).toBeLessThan(2_000_000_000);

    const item: AdminResourceItem = { startsAt: payload.startsAt } as AdminResourceItem;
    const formValues = mapItemToFormValues(item, fields);
    expect(formValues.startsAt).toBe("2026-08-02");
  });

  it("maps multiselect field to a string[]", () => {
    const fields: CrudField[] = [{ key: "tags", label: "Tags", type: "multiselect", options: [] }];
    const payload = mapFormToPayload({ tags: ["a", "b"] }, fields);
    expect(payload.tags).toEqual(["a", "b"]);
  });

  it("omits select field entirely when no value is chosen", () => {
    const fields: CrudField[] = [{ key: "status", label: "Status", type: "select", options: [] }];
    const payload = mapFormToPayload({ status: "" }, fields);
    expect("status" in payload).toBe(false);
  });

  it("maps radio field to the chosen option's value", () => {
    const fields: CrudField[] = [
      {
        key: "kind",
        label: "Kind",
        type: "radio",
        options: [
          { value: "one", label: "One" },
          { value: "two", label: "Two" },
        ],
      },
    ];
    const payload = mapFormToPayload({ kind: "two" }, fields);
    expect(payload.kind).toBe("two");
  });
});
