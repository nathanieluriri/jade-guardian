"use client";

import {
  createPromoCode,
  deletePromoCode,
  listPromoCodes,
  updatePromoCode,
} from "@/lib/api/admin-api";
import { OperationsCrudPage, type CrudField } from "@/features/admin/screens/operations/OperationsCrudPage";
import { OPERATIONS_LIST_PAGE } from "@/features/admin/screens/operations/optimistic-delete";

/**
 * Canonical field set matching the backend's PromoCodeCreate schema
 * (app/server/schemas/admin-features.ts). Keys outside this schema are
 * silently stripped by the backend.
 *
 * `promotion-service.ts` reads `discountValue ?? value ?? percentage`, so the
 * old `discount_value` key produced promos with a 0% discount. `active` (not
 * `is_active`) is the flag `isActive()` reads.
 */
export const PROMO_CODE_FIELDS: CrudField[] = [
  { key: "code", label: "Code", type: "text", required: true, placeholder: "CLEANM10" },
  { key: "title", label: "Title", type: "text", placeholder: "10% off your first clean" },
  { key: "description", label: "Description", type: "textarea", placeholder: "Promo details for internal reference." },
  {
    key: "discountType",
    label: "Discount Type",
    type: "radio",
    required: true,
    options: [
      { value: "PERCENT", label: "Percent" },
      { value: "FIXED", label: "Fixed" },
    ],
  },
  { key: "discountValue", label: "Discount Value", type: "number", required: true, placeholder: "10" },
  { key: "minimumSpend", label: "Minimum Spend", type: "money", placeholder: "0.00" },
  { key: "maximumDiscount", label: "Maximum Discount", type: "money", placeholder: "0.00" },
  { key: "currency", label: "Currency", type: "text", placeholder: "USD" },
  { key: "startsAt", label: "Starts At", type: "date" },
  { key: "expiresAt", label: "Expires At", type: "date" },
  { key: "active", label: "Active", type: "boolean" },
  { key: "maxRedemptions", label: "Max Redemptions", type: "number", placeholder: "500" },
];

function validatePromoCode(values: Record<string, unknown>): string | null {
  const discountType = values.discountType;
  const discountValue = Number(values.discountValue);
  if (discountType === "PERCENT" && Number.isFinite(discountValue) && discountValue > 100) {
    return "A percent discount cannot exceed 100.";
  }
  const startsAt = values.startsAt;
  const expiresAt = values.expiresAt;
  if (typeof startsAt === "string" && startsAt && typeof expiresAt === "string" && expiresAt) {
    if (new Date(expiresAt).getTime() <= new Date(startsAt).getTime()) {
      return "Expires At must be after Starts At.";
    }
  }
  return null;
}

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
      fields={PROMO_CODE_FIELDS}
      validateForm={validatePromoCode}
      listFn={() => listPromoCodes(OPERATIONS_LIST_PAGE)}
      createFn={createPromoCode}
      updateFn={updatePromoCode}
      deleteFn={deletePromoCode}
    />
  );
}
