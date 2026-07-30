"use client";

import {
  createPayoutAdjustment,
  deletePayoutAdjustment,
  listPayoutAdjustments,
  updatePayoutAdjustment,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

export default function PayoutAdjustmentsPage() {
  return (
    <OperationsCrudPage
      title="Payout Adjustments"
      description="Manage manual cleaner payout correction records."
      queryKey="payout-adjustments"
      readRequirement={{ method: "GET", path: "/v1/admins/payout-adjustments" }}
      createRequirement={{ method: "POST", path: "/v1/admins/payout-adjustments" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/payout-adjustments/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/payout-adjustments/{id}" }}
      fields={[
        { key: "cleaner_id", label: "Cleaner ID", type: "text", required: true },
        { key: "amount_minor", label: "Amount (Minor Units)", type: "number", required: true },
        { key: "currency", label: "Currency", type: "text", required: true, placeholder: "NGN" },
        { key: "adjustment_type", label: "Adjustment Type", type: "text", required: true, placeholder: "bonus|deduction" },
        { key: "reason", label: "Reason", type: "textarea", required: true },
        { key: "approved", label: "Approved", type: "boolean" },
      ]}
      listFn={() => listPayoutAdjustments({ skip: 0, limit: 100 })}
      createFn={createPayoutAdjustment}
      updateFn={updatePayoutAdjustment}
      deleteFn={deletePayoutAdjustment}
    />
  );
}
