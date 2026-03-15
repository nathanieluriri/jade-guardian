// Mock data for cleaner onboarding review

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

export const mockOnboardingCleaners: CleanerOnboarding[] = [
  {
    id: "cl_001",
    firstName: "Alice",
    lastName: "Johnson",
    email: "alice.johnson@example.com",
    date_created: "2026-03-14T09:23:00Z",
    onboarding_status: "PENDING",
    rejection_reason: null,
    profile: {
      location: {
        place_id: "ChIJOwg_06VPwokRYv534QaPC8g",
        place: "123 Main St, Brooklyn, NY 11201",
        service_radius_miles: 15,
      },
      weekly_availability: { days: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
      experience_level: "experienced",
      services: ["standard_cleaning", "deep_cleaning", "move_in_out"],
      government_id_image_url: "https://images.unsplash.com/photo-1578670812003-60745e2c2ea9?w=600&h=400&fit=crop",
      payout_information: {
        method: "bank_transfer",
        account_holder_name: "Alice Johnson",
        routing_number: "021***789",
        account_last_four: "4521",
      },
    },
    review_history: [],
    flags: { missing_profile: false, missing_document: false, missing_payout: false },
  },
  {
    id: "cl_002",
    firstName: "Bob",
    lastName: "Smith",
    email: "bob.smith@example.com",
    date_created: "2026-03-13T14:10:00Z",
    onboarding_status: "PENDING",
    rejection_reason: null,
    profile: {
      location: {
        place_id: "ChIJd8BlQ2BZwokRAFUEcm_qrcA",
        place: "456 Oak Ave, Manhattan, NY 10001",
        service_radius_miles: 10,
      },
      weekly_availability: { days: ["monday", "wednesday", "friday", "saturday"] },
      experience_level: "beginner",
      services: ["standard_cleaning"],
      government_id_image_url: "https://images.unsplash.com/photo-1578670812003-60745e2c2ea9?w=600&h=400&fit=crop",
      payout_information: {
        method: "bank_transfer",
        account_holder_name: "Bob Smith",
        routing_number: "026***123",
        account_last_four: "8832",
      },
    },
    review_history: [],
    flags: { missing_profile: false, missing_document: false, missing_payout: false },
  },
  {
    id: "cl_003",
    firstName: "Carlos",
    lastName: "Rivera",
    email: "carlos.rivera@example.com",
    date_created: "2026-03-12T08:45:00Z",
    onboarding_status: "APPROVED",
    rejection_reason: null,
    profile: {
      location: {
        place_id: "ChIJIQBpAG2ahYAR_6128GcTUEo",
        place: "789 Pine Rd, San Francisco, CA 94102",
        service_radius_miles: 20,
      },
      weekly_availability: { days: ["tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
      experience_level: "expert",
      services: ["standard_cleaning", "deep_cleaning", "move_in_out", "post_construction"],
      government_id_image_url: "https://images.unsplash.com/photo-1578670812003-60745e2c2ea9?w=600&h=400&fit=crop",
      payout_information: {
        method: "bank_transfer",
        account_holder_name: "Carlos Rivera",
        routing_number: "121***456",
        account_last_four: "2210",
      },
    },
    review_history: [
      { reviewer_id: "admin_001", decision: "APPROVED", reason: null, timestamp: "2026-03-12T16:30:00Z" },
    ],
    flags: { missing_profile: false, missing_document: false, missing_payout: false },
  },
  {
    id: "cl_004",
    firstName: "Dana",
    lastName: "Lee",
    email: "dana.lee@example.com",
    date_created: "2026-03-11T11:20:00Z",
    onboarding_status: "REJECTED",
    rejection_reason: "Government ID image is unreadable. Please upload a clearer photo with all four corners visible.",
    profile: {
      location: {
        place_id: "ChIJ7cv00DwsDogRAMDACa2m4K8",
        place: "321 Elm St, Chicago, IL 60601",
        service_radius_miles: 25,
      },
      weekly_availability: { days: ["saturday", "sunday"] },
      experience_level: "intermediate",
      services: ["standard_cleaning", "deep_cleaning"],
      government_id_image_url: null,
      payout_information: {
        method: "bank_transfer",
        account_holder_name: "Dana Lee",
        routing_number: "071***890",
        account_last_four: "7743",
      },
    },
    review_history: [
      { reviewer_id: "admin_002", decision: "REJECTED", reason: "Government ID image is unreadable. Please upload a clearer photo with all four corners visible.", timestamp: "2026-03-11T15:45:00Z" },
    ],
    flags: { missing_profile: false, missing_document: true, missing_payout: false },
  },
  {
    id: "cl_005",
    firstName: "Elena",
    lastName: "Petrov",
    email: "elena.petrov@example.com",
    date_created: "2026-03-14T16:05:00Z",
    onboarding_status: "PENDING",
    rejection_reason: null,
    profile: {
      location: {
        place_id: "ChIJE9on3F3HwoAR9AhGJW_fL-I",
        place: "555 Sunset Blvd, Los Angeles, CA 90028",
        service_radius_miles: 30,
      },
      weekly_availability: { days: ["monday", "tuesday", "thursday"] },
      experience_level: "experienced",
      services: ["standard_cleaning", "deep_cleaning", "move_in_out"],
      government_id_image_url: "https://images.unsplash.com/photo-1578670812003-60745e2c2ea9?w=600&h=400&fit=crop",
      payout_information: null,
    },
    review_history: [],
    flags: { missing_profile: false, missing_document: false, missing_payout: true },
  },
  {
    id: "cl_006",
    firstName: "Frank",
    lastName: "Okafor",
    email: "frank.okafor@example.com",
    date_created: "2026-03-10T07:30:00Z",
    onboarding_status: "PENDING",
    rejection_reason: null,
    profile: null,
    review_history: [],
    flags: { missing_profile: true, missing_document: true, missing_payout: true },
  },
];

export const mockOnboardingStats = {
  total_pending: 4,
  total_approved_today: 1,
  total_rejected_today: 1,
  total_reviewed_today: 2,
  avg_review_time_minutes: 4.2,
};

export const SERVICE_LABELS: Record<string, string> = {
  standard_cleaning: "Standard Cleaning",
  deep_cleaning: "Deep Cleaning",
  move_in_out: "Move In/Out Cleaning",
  post_construction: "Post-Construction Cleaning",
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
