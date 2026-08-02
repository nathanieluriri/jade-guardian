"use client";

import {
  createServiceDefinition,
  deleteServiceDefinition,
  listServiceDefinitions,
  updateServiceDefinition,
} from "@/lib/api/admin-api";
import { OperationsCrudPage, type CrudField } from "@/features/admin/screens/operations/OperationsCrudPage";
import { OPERATIONS_LIST_PAGE } from "@/features/admin/screens/operations/optimistic-delete";

// Canonical field set matching the backend's ServiceDefinitionCreate schema
// (app/server/schemas/admin-features.ts). Keys outside this schema are
// silently stripped by the backend, so this list must stay a subset of it.
export const SERVICE_DEFINITION_FIELDS: CrudField[] = [
  { key: "title", label: "Title", type: "text", required: true, placeholder: "Home Cleaning" },
  { key: "description", label: "Description", type: "textarea", placeholder: "What this service includes." },
  { key: "basePrice", label: "Base Price", type: "money", placeholder: "0.00" },
  { key: "hourlyRate", label: "Hourly Rate", type: "money", placeholder: "0.00" },
  { key: "minimumHours", label: "Minimum Hours", type: "number", placeholder: "1" },
  { key: "maximumHours", label: "Maximum Hours", type: "number", placeholder: "8" },
  { key: "hourIncrement", label: "Hour Increment", type: "number", placeholder: "0.5" },
  {
    key: "priceUnit",
    label: "Price Unit",
    type: "radio",
    options: [
      { value: "HOURLY", label: "Hourly" },
      { value: "FLAT", label: "Flat" },
    ],
  },
  { key: "currency", label: "Currency", type: "text", placeholder: "USD" },
  { key: "isAvailable", label: "Available", type: "boolean" },
  {
    key: "service_key",
    label: "Service Key",
    type: "text",
    placeholder: "home_cleaning_standard",
    helpText: "Internal handle used for operations tooling. Not shown to customers.",
  },
];

export default function ServiceDefinitionsPage() {
  return (
    <OperationsCrudPage
      title="Service Definitions"
      description="Manage base cleaning service definitions used by booking and pricing flows."
      queryKey="service-definitions"
      readRequirement={{ method: "GET", path: "/v1/admins/service-definitions" }}
      createRequirement={{ method: "POST", path: "/v1/admins/service-definitions" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/service-definitions/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/service-definitions/{id}" }}
      fields={SERVICE_DEFINITION_FIELDS}
      listFn={() => listServiceDefinitions(OPERATIONS_LIST_PAGE)}
      createFn={createServiceDefinition}
      updateFn={updateServiceDefinition}
      deleteFn={deleteServiceDefinition}
    />
  );
}
