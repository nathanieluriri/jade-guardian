/**
 * Domain types for the admin broadcast API — these mirror the broadcast
 * schema (`app/server/schemas/broadcast.ts`) defined in the separate
 * `Marcus-cleaning-backend` repository. That repo is not available from
 * here, so parity is a manual check: when the backend schema changes,
 * these types need to be updated by hand to match.
 *
 * A broadcast is one notification sent to a segment of users. Fan-out is
 * batched and resumable server-side; these types describe the request/response
 * shapes the admin console uses to drive it.
 */

export const AUDIENCE_TYPES = [
  'ALL',
  'ALL_CUSTOMERS',
  'ALL_CLEANERS',
  'USER_IDS',
  'CUSTOMERS_INACTIVE',
  'CUSTOMERS_WITH_BOOKINGS',
  'CUSTOMERS_NEVER_BOOKED',
  'CLEANERS_BY_ONBOARDING',
] as const

export type AudienceType = (typeof AUDIENCE_TYPES)[number]

export const ONBOARDING_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
] as const

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number]

/** Which extra fields each audience type requires — mirrors the backend superRefine. */
export const AUDIENCE_REQUIREMENTS: Record<
  AudienceType,
  ReadonlyArray<'userIds' | 'role' | 'inactiveDays' | 'onboardingStatus'>
> = {
  ALL: [],
  ALL_CUSTOMERS: [],
  ALL_CLEANERS: [],
  USER_IDS: ['userIds', 'role'],
  CUSTOMERS_INACTIVE: ['inactiveDays'],
  CUSTOMERS_WITH_BOOKINGS: [],
  CUSTOMERS_NEVER_BOOKED: [],
  CLEANERS_BY_ONBOARDING: ['onboardingStatus'],
}

/** Who a broadcast goes to. */
export interface BroadcastAudience {
  type: AudienceType
  /** For USER_IDS. Paired with `role`, since ids are per-collection. */
  userIds?: string[]
  /** Which role `userIds` belong to. */
  role?: 'customer' | 'cleaner'
  /** For CUSTOMERS_INACTIVE. 1..3650. */
  inactiveDays?: number
  /** For CLEANERS_BY_ONBOARDING. */
  onboardingStatus?: OnboardingStatus
}

export const BROADCAST_STATUSES = ['DRAFT', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'] as const

export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number]

export interface BroadcastCreateRequest {
  /** 1..120 chars. */
  title: string
  /** 1..500 chars. */
  body: string
  audience: BroadcastAudience
  /**
   * Notification type, which selects the channel, sound and deep link.
   * Defaults to `promo.broadcast`.
   */
  type?: string
  /** Attach a promo code so the app can deep-link straight to the offer. */
  promoId?: string | null
  promoCode?: string | null
  /** Extra key/values merged into the push payload. */
  data?: Record<string, string> | null
}

/** Dry-run: how many people would this reach? */
export interface AudiencePreviewOut {
  audience: BroadcastAudience
  total: number
  customers: number
  cleaners: number
  /** How many of those have at least one active push device registered. */
  reachableByPush: number
  /** Audience size before the marketing opt-out was applied. */
  matchedBeforeOptOut: number
  /** How many were dropped for having marketing notifications off. */
  suppressedByOptOut: number
}

export interface BroadcastOut {
  id: string
  title: string
  body: string
  type: string
  audience: BroadcastAudience
  status: BroadcastStatus
  promoId: string | null
  promoCode: string | null
  data: Record<string, string> | null
  /** Recipients resolved at dispatch time. */
  recipientCount: number
  /** How many have been processed so far — drives resumable batching. */
  processedCount: number
  sentCount: number
  failedCount: number
  createdBy: string | null
  dispatchedAt: number | null
  completedAt: number | null
  dateCreated: number | null
  lastUpdated: number | null
}

export interface BroadcastListOut {
  items: BroadcastOut[]
  nextCursor: string | null
  pageSize: number
}
