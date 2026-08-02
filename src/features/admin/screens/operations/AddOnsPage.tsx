"use client";

import {
  createAddOn,
  deleteAddOn,
  listAddOns,
  updateAddOn,
} from "@/lib/api/admin-api";
import { OperationsCrudPage, type CrudField } from "@/features/admin/screens/operations/OperationsCrudPage";
import { OPERATIONS_LIST_PAGE } from "@/features/admin/screens/operations/optimistic-delete";
import type { AdminResourcePayload } from "@/lib/api/types";

/**
 * Canonical field set matching the backend's AddOnCreate schema
 * (app/server/schemas/admin-features.ts). Keys outside this schema are
 * silently stripped by the backend, so this list must stay a subset of it.
 *
 * `addonScope` is NOT part of AddOnCreate — it is UI-only state that decides
 * whether `serviceId` gets sent at all. `catalog-service.ts`'s
 * `listServiceExtras` treats an add-on with no `serviceId` as global (applies
 * to every service), so leaving that field blank must never be the silent
 * default. `addonScope` forces an explicit choice and is stripped from the
 * payload by `addonPayloadForBackend` before it reaches the API.
 */
export const ADD_ON_FIELDS: CrudField[] = [
  { key: "title", label: "Title", type: "text", required: true, placeholder: "Window Cleaning" },
  { key: "price", label: "Price", type: "money", required: true, placeholder: "0.00" },
  { key: "currency", label: "Currency", type: "text", placeholder: "USD" },
  { key: "isAvailable", label: "Available", type: "boolean" },
  {
    key: "addonScope",
    label: "Applies To",
    type: "radio",
    required: true,
    options: [
      { value: "all", label: "All services" },
      { value: "one", label: "One service" },
    ],
    helpText: "You must choose explicitly — this is never defaulted for you.",
  },
  {
    key: "serviceId",
    label: "Service ID",
    type: "text",
    placeholder: "507f1f77bcf86cd799439011",
    helpText:
      "Required when \"One service\" is selected. Leaving this empty makes the add-on global — it will apply to every service in the catalogue.",
  },
  { key: "description", label: "Description", type: "textarea", placeholder: "What this add-on includes." },
  {
    key: "addon_key",
    label: "Add-on Key",
    type: "text",
    placeholder: "window_cleaning",
    helpText: "Internal handle used for operations tooling. Not shown to customers.",
  },
];

/** Cross-field rule: picking "one service" without a serviceId must block submit. */
export function requireServiceIdWhenScopedToOne(values: Record<string, unknown>): string | null {
  const scope = String(values.addonScope ?? "").trim();
  if (scope !== "all" && scope !== "one") {
    return "Choose whether this add-on applies to all services or one service.";
  }
  if (scope === "one" && String(values.serviceId ?? "").trim().length === 0) {
    return "Select a service, or switch to \"All services\" if that's intended.";
  }
  return null;
}

/**
 * Removes the UI-only `addonScope` field and enforces that `serviceId` is
 * only sent when the admin deliberately scoped the add-on to one service.
 */
export function addonPayloadForBackend(payload: AdminResourcePayload): AdminResourcePayload {
  const { addonScope, ...rest } = payload;
  if (addonScope !== "one") {
    delete rest.serviceId;
  }
  return rest;
}

export default function AddOnsPage() {
  return (
    <OperationsCrudPage
      title="Add-on Catalog"
      description="Manage optional add-ons attached to bookings."
      queryKey="add-ons"
      readRequirement={{ method: "GET", path: "/v1/admins/add-ons" }}
      createRequirement={{ method: "POST", path: "/v1/admins/add-ons" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/add-ons/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/add-ons/{id}" }}
      fields={ADD_ON_FIELDS}
      validateForm={requireServiceIdWhenScopedToOne}
      listFn={() => listAddOns(OPERATIONS_LIST_PAGE)}
      createFn={(payload) => createAddOn(addonPayloadForBackend(payload))}
      updateFn={(id, payload) => updateAddOn(id, addonPayloadForBackend(payload))}
      deleteFn={deleteAddOn}
    />
  );
}
