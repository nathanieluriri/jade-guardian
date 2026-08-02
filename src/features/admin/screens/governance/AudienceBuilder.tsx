import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AUDIENCE_REQUIREMENTS,
  AUDIENCE_TYPES,
  ONBOARDING_STATUSES,
  type AudienceType,
  type BroadcastAudience,
} from "@/lib/api/broadcast-types";

/** Human labels for each audience type radio option. */
const AUDIENCE_TYPE_LABELS: Record<AudienceType, string> = {
  ALL: "Everyone",
  ALL_CUSTOMERS: "All customers",
  ALL_CLEANERS: "All cleaners",
  USER_IDS: "Specific user IDs",
  CUSTOMERS_INACTIVE: "Inactive customers",
  CUSTOMERS_WITH_BOOKINGS: "Customers with bookings",
  CUSTOMERS_NEVER_BOOKED: "Customers who never booked",
  CLEANERS_BY_ONBOARDING: "Cleaners by onboarding status",
};

const ONBOARDING_STATUS_LABELS: Record<(typeof ONBOARDING_STATUSES)[number], string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/**
 * Pure validator — mirrors the backend's `BroadcastAudience` superRefine in
 * `app/server/schemas/broadcast.ts`. Kept dependency-free so other screens
 * (Tasks 4-5) can call it without rendering.
 */
export function validateAudience(audience: BroadcastAudience): string | null {
  const required = AUDIENCE_REQUIREMENTS[audience.type];

  if (required.includes("userIds") && !audience.userIds?.length) {
    return "userIds is required for USER_IDS";
  }
  if (required.includes("role") && !audience.role) {
    return "role is required for USER_IDS";
  }
  if (required.includes("inactiveDays")) {
    const days = audience.inactiveDays;
    if (days == null || !Number.isInteger(days) || days < 1 || days > 3650) {
      return "inactiveDays must be an integer between 1 and 3650";
    }
  }
  if (required.includes("onboardingStatus") && !audience.onboardingStatus) {
    return "onboardingStatus is required for CLEANERS_BY_ONBOARDING";
  }

  return null;
}

/** Parses the userIds textarea: newline- or comma-separated, trimmed, blanks dropped. */
function parseUserIds(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

interface AudienceBuilderProps {
  value: BroadcastAudience;
  onChange: (next: BroadcastAudience) => void;
}

/**
 * Audience selector for the broadcast composer. Fields shown are driven by
 * `AUDIENCE_REQUIREMENTS` (Task 1) so this can never drift from the
 * backend's `superRefine` validation — the same map both tell the UI what to
 * show and tell `validateAudience` what to require.
 *
 * Switching `type` clears any fields the new type doesn't need. The backend
 * schema doesn't reject unknown keys, so a stale field from a previous
 * selection would otherwise ride along silently in the payload.
 */
export function AudienceBuilder({ value, onChange }: AudienceBuilderProps) {
  const required = AUDIENCE_REQUIREMENTS[value.type];

  function handleTypeChange(nextType: AudienceType) {
    // Only carry over `type` — every other field is dropped, and the fields
    // relevant to `nextType` are (re)populated below as the admin fills them in.
    onChange({ type: nextType });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Audience</Label>
        <RadioGroup
          value={value.type}
          onValueChange={(next) => handleTypeChange(next as AudienceType)}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {AUDIENCE_TYPES.map((type) => (
            <div key={type} className="flex items-center gap-2">
              <RadioGroupItem value={type} id={`audience-type-${type}`} />
              <Label htmlFor={`audience-type-${type}`} className="font-normal">
                {AUDIENCE_TYPE_LABELS[type]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {required.includes("userIds") && (
        <div className="space-y-2">
          <Label htmlFor="audience-user-ids">User IDs</Label>
          <Textarea
            id="audience-user-ids"
            value={value.userIds?.join("\n") ?? ""}
            onChange={(event) => {
              onChange({ ...value, userIds: parseUserIds(event.target.value) });
            }}
            placeholder="One user ID per line, or comma-separated"
          />
        </div>
      )}

      {required.includes("role") && (
        <div className="space-y-2">
          <Label>Role</Label>
          <RadioGroup
            value={value.role ?? ""}
            onValueChange={(next) => {
              onChange({ ...value, role: next as "customer" | "cleaner" });
            }}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="customer" id="audience-role-customer" />
              <Label htmlFor="audience-role-customer" className="font-normal">
                Customer
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cleaner" id="audience-role-cleaner" />
              <Label htmlFor="audience-role-cleaner" className="font-normal">
                Cleaner
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {required.includes("inactiveDays") && (
        <div className="space-y-2">
          <Label htmlFor="audience-inactive-days">Inactive days</Label>
          <Input
            id="audience-inactive-days"
            type="number"
            min={1}
            max={3650}
            value={value.inactiveDays ?? ""}
            onChange={(event) => {
              const parsed = event.target.value === "" ? undefined : Number(event.target.value);
              onChange({ ...value, inactiveDays: parsed });
            }}
          />
        </div>
      )}

      {required.includes("onboardingStatus") && (
        <div className="space-y-2">
          <Label htmlFor="audience-onboarding-status">Onboarding status</Label>
          <Select
            value={value.onboardingStatus ?? ""}
            onValueChange={(next) => {
              onChange({
                ...value,
                onboardingStatus: next as (typeof ONBOARDING_STATUSES)[number],
              });
            }}
          >
            <SelectTrigger id="audience-onboarding-status" aria-label="Onboarding status">
              <SelectValue placeholder="Select a status" />
            </SelectTrigger>
            <SelectContent>
              {ONBOARDING_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {ONBOARDING_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
