"use client";

import {
  createPricingRule,
  deletePricingRule,
  listPricingRules,
  updatePricingRule,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

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
      fields={[
        { key: "rule_name", label: "Rule Name", type: "text", required: true, placeholder: "Weekend Evening Surge" },
        { key: "rule_type", label: "Rule Type", type: "text", required: true, placeholder: "time_window" },
        { key: "multiplier", label: "Multiplier", type: "number", required: true, placeholder: "1.2" },
        { key: "priority", label: "Priority", type: "number", required: true, placeholder: "10" },
        { key: "zone_codes", label: "Zone Codes (CSV)", type: "array_csv", placeholder: "LA-IKJ, LA-VI" },
        { key: "day_of_week", label: "Day Of Week (CSV)", type: "array_csv", placeholder: "5,6" },
        { key: "start_hour", label: "Start Hour", type: "number", placeholder: "18" },
        { key: "end_hour", label: "End Hour", type: "number", placeholder: "22" },
        { key: "is_active", label: "Active", type: "boolean" },
      ]}
      listFn={() => listPricingRules({ skip: 0, limit: 100 })}
      createFn={createPricingRule}
      updateFn={updatePricingRule}
      deleteFn={deletePricingRule}
    />
  );
}
