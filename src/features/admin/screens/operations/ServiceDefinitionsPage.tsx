"use client";

import {
  createServiceDefinition,
  deleteServiceDefinition,
  listServiceDefinitions,
  updateServiceDefinition,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";
import { OPERATIONS_LIST_PAGE } from "@/features/admin/screens/operations/optimistic-delete";

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
      fields={[
        { key: "service_key", label: "Service Key", type: "text", required: true, placeholder: "home_cleaning_standard" },
        { key: "display_name", label: "Display Name", type: "text", required: true, placeholder: "Home Cleaning" },
        { key: "base_duration_minutes", label: "Base Duration (Minutes)", type: "number", required: true, placeholder: "120" },
        { key: "is_active", label: "Active", type: "boolean" },
        { key: "notes", label: "Notes", type: "textarea", placeholder: "Internal operational notes." },
      ]}
      listFn={() => listServiceDefinitions(OPERATIONS_LIST_PAGE)}
      createFn={createServiceDefinition}
      updateFn={updateServiceDefinition}
      deleteFn={deleteServiceDefinition}
    />
  );
}
