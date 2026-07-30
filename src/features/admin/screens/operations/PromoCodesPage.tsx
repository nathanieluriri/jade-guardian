"use client";

import {
  createPromoCode,
  deletePromoCode,
  listPromoCodes,
  updatePromoCode,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

export default function PromoCodesPage() {
  return (
    <OperationsCrudPage
      title="Promo Codes"
      description="Manage discount campaigns and redemption lifecycle controls."
      queryKey="promo-codes"
      readRequirement={{ method: "GET", path: "/v1/admins/promo-codes" }}
      createRequirement={{ method: "POST", path: "/v1/admins/promo-codes" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/promo-codes/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/promo-codes/{id}" }}
      fields={[
        { key: "code", label: "Code", type: "text", required: true, placeholder: "CLEANM10" },
        { key: "discount_type", label: "Discount Type", type: "text", required: true, placeholder: "percentage" },
        { key: "discount_value", label: "Discount Value", type: "number", required: true, placeholder: "10" },
        { key: "max_redemptions", label: "Max Redemptions", type: "number", placeholder: "500" },
        { key: "valid_from_epoch", label: "Valid From (Epoch)", type: "number", placeholder: "1774056000" },
        { key: "valid_to_epoch", label: "Valid To (Epoch)", type: "number", placeholder: "1776651600" },
        { key: "is_active", label: "Active", type: "boolean" },
      ]}
      listFn={() => listPromoCodes(0, 100)}
      createFn={createPromoCode}
      updateFn={updatePromoCode}
      deleteFn={deletePromoCode}
    />
  );
}
