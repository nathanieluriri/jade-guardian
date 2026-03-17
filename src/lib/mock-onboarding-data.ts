export type OnboardingStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ExperienceLevel = "beginner" | "intermediate" | "experienced" | "expert";

export interface CleanerOnboarding {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  date_created: string;
  onboarding_status: OnboardingStatus;
  rejection_reason: string | null;
  profile: {
    location: {
      place_id: string;
      place: string;
      service_radius_miles: number;
    };
    weekly_availability: {
      days: string[];
    };
    experience_level: ExperienceLevel;
    services: string[];
    government_id_image_url: string | null;
    payout_information: {
      method: string;
      account_holder_name: string;
      routing_number: string;
      account_last_four: string;
    } | null;
  } | null;
  review_history: Array<{
    reviewer_id: string;
    decision: OnboardingStatus;
    reason: string | null;
    timestamp: string;
  }>;
  flags: {
    missing_profile: boolean;
    missing_document: boolean;
    missing_payout: boolean;
  };
}

interface ApiCleanerProfile {
  location?: {
    place_id?: string;
    place?: {
      formatted_address?: string;
      name?: string;
    };
    service_radius_miles?: number;
  };
  weekly_availability?: {
    days?: string[];
  };
  experience_level?: string;
  services?: string[];
  government_id_image_url?: string | null;
  payout_information?: {
    account_holder_name?: string;
    routing_number?: string;
    sort_code?: string;
    bank_name?: string;
    account_number?: string;
  } | null;
}

interface ApiCleanerInput {
  id: string;
  email: string;
  date_created?: string;
  firstName?: string;
  lastName?: string;
  full_name?: string;
  onboarding_status?: OnboardingStatus;
  rejection_reason?: string | null;
  profile?: ApiCleanerProfile;
}

export const SERVICE_LABELS: Record<string, string> = {
  STANDARD: "Standard Cleaning",
  DEEP_CLEAN: "Deep Cleaning",
  OFFICE: "Office Cleaning",
  CUSTOM: "Custom Cleaning",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  experienced: "Experienced",
  expert: "Expert",
};

export const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function normalizeWeekday(day: string): string {
  const lower = day.toLowerCase();
  if (lower.endsWith("day")) return lower;
  return `${lower}day`;
}

function normalizeExperienceLevel(level?: string): ExperienceLevel {
  const normalized = (level || "beginner").toLowerCase();
  if (normalized === "intermediate" || normalized === "experienced" || normalized === "expert") {
    return normalized;
  }
  return "beginner";
}

export function mapCleanerToOnboarding(cleaner: ApiCleanerInput): CleanerOnboarding {
  const fullName = cleaner.full_name || `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim();
  const [firstName, ...rest] = fullName ? fullName.split(" ") : ["Cleaner", cleaner.id.slice(-4)];
  const lastName = rest.join(" ") || cleaner.lastName || "";

  const profile = cleaner.profile;
  const location = profile?.location;
  const payout = profile?.payout_information;

  return {
    id: cleaner.id,
    firstName: cleaner.firstName || firstName || "Cleaner",
    lastName: cleaner.lastName || lastName || "",
    email: cleaner.email,
    date_created: cleaner.date_created || new Date().toISOString(),
    onboarding_status: cleaner.onboarding_status || "PENDING",
    rejection_reason: cleaner.rejection_reason || null,
    profile: profile
      ? {
          location: {
            place_id: location?.place_id || "unknown",
            place: location?.place?.formatted_address || location?.place?.name || "Location unavailable",
            service_radius_miles: location?.service_radius_miles || 10,
          },
          weekly_availability: {
            days: Array.isArray(profile?.weekly_availability?.days)
              ? profile.weekly_availability.days.map((d: string) => normalizeWeekday(String(d)))
              : [],
          },
          experience_level: normalizeExperienceLevel(profile?.experience_level),
          services: profile?.services || [],
          government_id_image_url: profile?.government_id_image_url || null,
          payout_information: payout
            ? {
                method: "bank_transfer",
                account_holder_name: payout.account_holder_name || "N/A",
                routing_number: payout.routing_number || payout.sort_code || payout.bank_name || "N/A",
                account_last_four: (payout.account_number || "0000").slice(-4),
              }
            : null,
        }
      : null,
    review_history: [],
    flags: {
      missing_profile: !profile,
      missing_document: !profile?.government_id_image_url,
      missing_payout: !profile?.payout_information,
    },
  };
}

export function computeOnboardingStats(cleaners: CleanerOnboarding[]) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    total_pending: cleaners.filter((c) => c.onboarding_status === "PENDING").length,
    total_approved_today: cleaners.filter((c) => c.onboarding_status === "APPROVED" && c.date_created.slice(0, 10) === today).length,
    total_rejected_today: cleaners.filter((c) => c.onboarding_status === "REJECTED" && c.date_created.slice(0, 10) === today).length,
    total_reviewed_today: cleaners.filter((c) => c.onboarding_status !== "PENDING" && c.date_created.slice(0, 10) === today).length,
    avg_review_time_minutes: 5,
  };
}
