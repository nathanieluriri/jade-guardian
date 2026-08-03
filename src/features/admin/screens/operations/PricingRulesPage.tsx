"use client";

import {
  createPricingRule,
  deletePricingRule,
  listPricingRules,
  updatePricingRule,
} from "@/lib/api/admin-api";
import { OperationsCrudPage, type CrudField } from "@/features/admin/screens/operations/OperationsCrudPage";
import { OPERATIONS_LIST_PAGE } from "@/features/admin/screens/operations/optimistic-delete";

const DAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

/**
 * `dynamic_pricing_rule` has no backend consumer, so field names are kept
 * exactly as the admin console already writes them (see
 * app/server/schemas/admin-features.ts, PricingRuleCreate) — renaming would
 * be pure churn. Only the controls get better here.
 *
 * `rule_type` is `z.string().min(1)` on the backend, not an enum — a stored
 * record may carry a `rule_type` outside COMMON_PRICING_RULE_TYPES. A hard
 * `select` would make such a record uneditable (or silently rewrite its
 * rule_type on an unrelated save), so this uses the `select` field type,
 * whose payload mapping falls through to the plain-string branch in
 * `mapFormToPayload` and therefore preserves an out-of-list stored value
 * untouched as long as the admin doesn't deliberately change it. The list
 * below is a guide, not a constraint — see the round-trip test in
 * `src/test/promo-and-config-fields.test.tsx`.
 */
export const PRICING_RULE_FIELDS: CrudField[] = [
  { key: "rule_name", label: "Rule Name", type: "text", required: true, placeholder: "Weekend Evening Surge" },
  {
    key: "rule_type",
    label: "Rule Type",
    type: "select",
    required: true,
    options: [
      { value: "time_window", label: "Time Window" },
      { value: "day_of_week", label: "Day of Week" },
      { value: "zone", label: "Zone" },
      { value: "demand", label: "Demand" },
    ],
    helpText: "Suggested values only — a record's existing rule_type is preserved even if it isn't in this list.",
  },
  { key: "multiplier", label: "Multiplier", type: "number", required: true, placeholder: "1.2" },
  { key: "priority", label: "Priority", type: "number", required: true, placeholder: "10" },
  { key: "zone_codes", label: "Zone Codes (CSV)", type: "array_csv", placeholder: "LA-IKJ, LA-VI" },
  { key: "day_of_week", label: "Day Of Week", type: "multiselect", options: DAY_OPTIONS },
  { key: "start_hour", label: "Start Hour", type: "number", placeholder: "18" },
  { key: "end_hour", label: "End Hour", type: "number", placeholder: "22" },
  { key: "is_active", label: "Active", type: "boolean" },
];

export default function PricingRulesPage() {
  return (
    <OperationsCrudPage
      title="Dynamic Pricing Rules"
      description="Manage conditional multipliers and rule priority for operational pricing."
      queryKey="pricing-rules"
      readRequirement={{ method: "GET", path: "/v1/admins/pricing-rules" }}
      createRequirement={{ method: "POST", path: "/v1/admins/pricing-rules" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/pricing-rules/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/pricing-rules/{id}" }}
      fields={PRICING_RULE_FIELDS}
      listFn={() => listPricingRules(OPERATIONS_LIST_PAGE)}
      createFn={createPricingRule}
      updateFn={updatePricingRule}
      deleteFn={deletePricingRule}
      templateFeature="pricing-rules"
    />
  );
}
