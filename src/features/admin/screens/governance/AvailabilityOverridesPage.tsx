"use client";

import {
  createAvailabilityOverride,
  deleteAvailabilityOverride,
  listAvailabilityOverrides,
  updateAvailabilityOverride,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

export default function AvailabilityOverridesPage() {
  return (
    <OperationsCrudPage
      title="Availability Overrides"
      description="Manage temporary blocking/unblocking windows for cleaner availability."
      queryKey="availability-overrides"
      readRequirement={{ method: "GET", path: "/v1/admins/availability-overrides" }}
      createRequirement={{ method: "POST", path: "/v1/admins/availability-overrides" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/availability-overrides/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/availability-overrides/{id}" }}
      fields={[
        { key: "cleaner_id", label: "Cleaner ID", type: "text", required: true },
        { key: "start_epoch", label: "Start Epoch", type: "number", required: true },
        { key: "end_epoch", label: "End Epoch", type: "number", required: true },
        { key: "override_type", label: "Override Type", type: "text", required: true, placeholder: "block|unblock" },
        { key: "reason", label: "Reason", type: "textarea", required: true },
        { key: "is_active", label: "Active", type: "boolean" },
      ]}
      listFn={() => listAvailabilityOverrides({ skip: 0, limit: 100 })}
      createFn={createAvailabilityOverride}
      updateFn={updateAvailabilityOverride}
      deleteFn={deleteAvailabilityOverride}
    />
  );
}
