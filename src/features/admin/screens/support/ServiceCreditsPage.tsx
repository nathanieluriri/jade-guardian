"use client";

import {
  createServiceCredit,
  deleteServiceCredit,
  listServiceCredits,
  updateServiceCredit,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

export default function ServiceCreditsPage() {
  return (
    <OperationsCrudPage
      title="Service Credits"
      description="Manage service credit ledger entries and customer credit adjustments."
      queryKey="service-credits"
      readRequirement={{ method: "GET", path: "/v1/admins/service-credits" }}
      createRequirement={{ method: "POST", path: "/v1/admins/service-credits" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/service-credits/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/service-credits/{id}" }}
      fields={[
        { key: "customer_id", label: "Customer ID", type: "text", required: true },
        { key: "amount_minor", label: "Amount (Minor Units)", type: "number", required: true },
        { key: "currency", label: "Currency", type: "text", required: true, placeholder: "NGN" },
        { key: "entry_type", label: "Entry Type", type: "text", required: true, placeholder: "credit|debit" },
        { key: "source", label: "Source", type: "text", placeholder: "support_adjustment" },
        { key: "note", label: "Note", type: "textarea" },
      ]}
      listFn={() => listServiceCredits({ skip: 0, limit: 100 })}
      createFn={createServiceCredit}
      updateFn={updateServiceCredit}
      deleteFn={deleteServiceCredit}
    />
  );
}
