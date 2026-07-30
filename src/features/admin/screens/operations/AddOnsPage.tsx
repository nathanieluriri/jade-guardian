"use client";

import {
  createAddOn,
  deleteAddOn,
  listAddOns,
  updateAddOn,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

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
      fields={[
        { key: "addon_key", label: "Add-on Key", type: "text", required: true, placeholder: "window_cleaning" },
        { key: "display_name", label: "Display Name", type: "text", required: true, placeholder: "Window Cleaning" },
        { key: "price_minor", label: "Price (Minor Units)", type: "number", required: true, placeholder: "2500" },
        { key: "currency", label: "Currency", type: "text", required: true, placeholder: "NGN" },
        { key: "is_active", label: "Active", type: "boolean" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      listFn={() => listAddOns({ skip: 0, limit: 100 })}
      createFn={createAddOn}
      updateFn={updateAddOn}
      deleteFn={deleteAddOn}
    />
  );
}
