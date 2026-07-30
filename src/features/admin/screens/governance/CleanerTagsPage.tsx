"use client";

import {
  createCleanerTag,
  deleteCleanerTag,
  listCleanerTags,
  updateCleanerTag,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

export default function CleanerTagsPage() {
  return (
    <OperationsCrudPage
      title="Cleaner Tags"
      description="Manage cleaner skill/equipment/certification tags and verification status."
      queryKey="cleaner-tags"
      readRequirement={{ method: "GET", path: "/v1/admins/cleaner-tags" }}
      createRequirement={{ method: "POST", path: "/v1/admins/cleaner-tags" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/cleaner-tags/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/cleaner-tags/{id}" }}
      fields={[
        { key: "cleaner_id", label: "Cleaner ID", type: "text", required: true },
        { key: "tag", label: "Tag", type: "text", required: true, placeholder: "deep_cleaning" },
        { key: "tag_type", label: "Tag Type", type: "text", required: true, placeholder: "skill|equipment|certification" },
        { key: "is_verified", label: "Verified", type: "boolean" },
        { key: "verified_by_admin_id", label: "Verified By Admin ID", type: "text" },
      ]}
      listFn={() => listCleanerTags(0, 100)}
      createFn={createCleanerTag}
      updateFn={updateCleanerTag}
      deleteFn={deleteCleanerTag}
    />
  );
}
