export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  requestId?: string;
  request_id?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
}

export interface AdminProfilePermissionEntry {
  key?: string;
  path: string;
  methods: string[];
}

export interface AdminProfile {
  id: string;
  full_name?: string;
  email?: string;
  accountStatus?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  email_verified?: boolean;
  last_auth_at?: number | null;
  isSuperAdmin?: boolean;
  accessPreset: string | null;
  mustChangePassword: boolean;
  totpEnabled: boolean;
  permissionList?: string[] | { permissions: Array<string | AdminProfilePermissionEntry> };
}

/** Camel-cased token bundle matching the backend's `TokenResponse` — never persisted by the web client. */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  language: "en" | "fr";
}

export interface AdminOtpChallenge {
  otpRequired: true;
  otpChallengeId: string;
  method: "email" | "totp";
}

export interface AdminLoginSuccess {
  admin: AdminProfile;
  tokens: TokenResponse | null;
}

/** `POST /admins/login` (and the `verify-otp` result): either an OTP challenge or a completed login. */
export type AdminLoginResponse = AdminOtpChallenge | AdminLoginSuccess;

/** `POST /admins/2fa/setup` response — a pending secret to render as a QR code. */
export interface TotpSetupData {
  secret: string;
  otpauthUri: string;
}

/** `POST /admins/2fa/verify` and `.../backup-codes/regenerate` response — shown once, in plaintext. */
export interface TotpBackupCodesData {
  backupCodes: string[];
}

/** `GET /admins/access-presets` item. */
export interface AccessPresetSummary {
  key: string;
  label: string;
  description: string;
  permissionCount: number;
}

export interface PermissionGroupPermission {
  key?: string;
  name?: string;
  path?: string;
  methods?: string[];
  description?: string;
}

export interface AdminPermissionGroup {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  is_built_in?: boolean;
  source?: "built_in" | "custom" | string;
  type?: "built_in" | "custom" | string;
  permissions?: Array<string | PermissionGroupPermission>;
}

export interface AdminPermissionGroupsResponse {
  builtIn?: AdminPermissionGroup[];
  custom?: AdminPermissionGroup[];
}

export interface AdminElevationRequestStatus {
  request_id?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED" | string;
  reason?: string | null;
  requestedPermissions?: string[];
  requestedPermissionGroups?: string[];
  grantedPermissions?: string[];
  reviewer_id?: string | null;
  reviewer_name?: string | null;
  reviewed_at?: number | null;
  date_created?: number | null;
  date_updated?: number | null;
}

export type ElevationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ElevationRequestItem {
  requestId: string;
  adminId: string;
  status: ElevationStatus;
  reason: string | null;
  requestedPermissions: string[];
  requestedPermissionGroups: string[];
  grantedPermissions: string[];
  reviewedBy: string | null;
  reviewedAt: number | null;
  decisionNote: string | null;
  dateCreated: number | null;
  lastUpdated: number | null;
}

export interface DecideElevationRequestPayload {
  decision: "APPROVED" | "REJECTED";
  grantedPermissions?: string[];
  note?: string | null;
}

export interface DecideElevationResponse {
  requestId: string;
  status: ElevationStatus;
  grantedPermissions: string[];
  decisionNote: string | null;
  reviewedBy: string;
  reviewedAt: number;
}

export interface SubmitElevationRequestPayload {
  requestedPermissionGroups: string[];
  reason: string;
}

export interface SessionRevokeResponse {
  revokedAccessSessions: number;
  revokedRefreshSessions: number;
}

export interface CreateAdminRequest {
  full_name: string;
  email: string;
  password: string;
}

export interface MonitoringOverview {
  login_failures_last_hour: number;
  login_success_last_hour: number;
  refresh_failures_last_hour: number;
  open_alert_count: number;
  high_alert_count: number;
  critical_alert_count: number;
  active_admin_sessions: number;
  suspicious_login_successes_last_day: number;
}

export interface AuthHeatmapCell {
  day_of_week: number;
  hour_of_day: number;
  success_count: number;
  failure_count: number;
}

export interface MonitoringAlert {
  _id: string;
  rule_key: string;
  severity: "info" | "warning" | "high" | "critical";
  title: string;
  summary: string;
  status: string;
  is_read: boolean;
  ack_owner_id: string | null;
  last_fired_at: number;
  date_created: number;
  source_ip?: string;
  affected_user?: string;
}

export interface SessionAnomalies {
  active_sessions_by_admin: Record<string, number>;
  global_active_sessions: number;
  long_lived_session_count: number;
  recent_session_spike_detected: boolean;
}

export interface AlertSlaMetrics {
  mtta_seconds: number;
  mttr_seconds: number;
  acknowledged_count: number;
  resolved_count: number;
}

export interface DeniedPermissionItem {
  permission_key: string;
  deny_count: number;
  admins: string[];
}

export interface PermissionCatalogResponse {
  grouped?: Array<{
    resource: string;
    routes: Array<{
      resource: string;
      method: string;
      path: string;
      normalized_path: string;
      key: string;
      endpoint_name: string;
      summary?: string;
      requires_auth?: boolean;
    }>;
  }>;
  flat?: {
    permissions: Array<{
      name: string;
      methods: string[];
      path: string;
      key?: string;
      description?: string;
    }>;
  };
}

export interface Permission {
  name: string;
  key: string;
  methods: string[];
  path: string;
  description?: string;
}

export interface RoleTemplate {
  role: "cleaner" | "customer";
  source?: string;
  permissionList: {
    permissions: Permission[];
  };
}

export interface CleanerListItem {
  id?: string;
  _id?: string;
  firstName?: string;
  lastName?: string;
  full_name?: string;
  email: string;
  date_created?: string;
  onboarding_status?: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason?: string | null;
  profile?: unknown;
}

export interface CustomerListItem {
  id?: string;
  _id?: string;
  firstName?: string;
  lastName?: string;
  full_name?: string;
  email: string;
  date_created?: string;
  accountStatus?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

export type AuditEventStatus = "success" | "failed" | "denied" | "warning" | "critical";
export type AuditEventSeverity = "info" | "warning" | "high" | "critical";
export type AuditSort = "asc" | "desc";
export type AuditRedaction = "strict" | "standard" | "none";
export type ExportJobStatus = "queued" | "processing" | "ready" | "failed";

export interface AuditActor {
  id: string;
  type?: string;
  display_name?: string;
  email?: string;
}

export interface AuditTarget {
  id: string;
  type?: string;
  display_name?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: number;
  request_id?: string;
  actor?: AuditActor;
  target?: AuditTarget;
  event_type?: string;
  action?: string;
  summary?: string;
  method?: string;
  endpoint?: string;
  status?: AuditEventStatus | string;
  http_status_code?: number;
  severity?: AuditEventSeverity;
  ip_address?: string;
  user_agent?: string;
  permission?: Record<string, unknown>;
  payload_redacted?: Record<string, unknown>;
  changes?: Array<{ field?: string; before?: unknown; after?: unknown }>;
  related?: Record<string, unknown>;
  tags?: string[];
  risk_score?: number;
}

export interface AuditPagination {
  start?: number;
  stop?: number;
  count: number;
  total?: number;
  next_cursor?: string | null;
  has_more: boolean;
}

export interface AuditHistoryResponse {
  items: AuditEvent[];
  pagination: AuditPagination;
  query?: Record<string, unknown>;
}

export interface AuditHistoryFilters {
  start?: number;
  stop?: number;
  cursor?: string | null;
  sort?: AuditSort;
  actor_id?: string;
  actor_type?: string;
  target_id?: string;
  target_type?: string;
  endpoint?: string;
  method?: string;
  status?: string;
  event_type?: string;
  severity?: string;
  request_id?: string;
  ip?: string;
  from_epoch?: number;
  to_epoch?: number;
  tags?: string[];
  include_payload?: boolean;
  include_related?: boolean;
}

export interface AuditExportCreateRequest {
  actor_id?: string | null;
  actor_type?: string | null;
  target_id?: string | null;
  target_type?: string | null;
  endpoint?: string | null;
  method?: string | null;
  status?: string | null;
  event_type?: string | null;
  severity?: string | null;
  request_id?: string | null;
  ip?: string | null;
  from_epoch?: number | null;
  to_epoch?: number | null;
  tags?: string[] | null;
  include_payload?: boolean;
  include_related?: boolean;
  format?: "csv";
  limit?: number;
}

export interface AuditExportJob {
  export_id: string;
  status: ExportJobStatus;
  estimated_rows?: number;
  download_url?: string | null;
  expires_at?: number | string;
}

export interface RoleTemplatePreviewResult {
  role: "cleaner" | "customer";
  additions?: number;
  removals?: number;
  changed_keys?: string[];
  warnings?: string[];
  [key: string]: unknown;
}

export interface RoleTemplateRolloutImpact {
  role: "cleaner" | "customer";
  matched_users?: number;
  modified_users?: number;
  [key: string]: unknown;
}

export interface UsersSummaryReport {
  total_users?: number;
  total_cleaners?: number;
  total_customers?: number;
  signups_24h?: number;
  signups_7d?: number;
  signups_30d?: number;
  pending_onboarding?: number;
  approval_rate?: number;
  [key: string]: unknown;
}

export interface SignupTrendPoint {
  label?: string;
  period?: string;
  cleaners?: number;
  customers?: number;
  total?: number;
  [key: string]: unknown;
}

export interface AdminAutocompleteUser {
  id?: string;
  _id?: string;
  firstName?: string;
  lastName?: string;
  full_name?: string;
  email?: string;
  allow_admin_selection?: boolean;
  [key: string]: unknown;
}

export interface AdminUsersAutocompleteResponse {
  customers?: AdminAutocompleteUser[];
  cleaners?: AdminAutocompleteUser[];
}

export interface AdminCustomerPlaceOut {
  place_id: string;
  label?: string;
  name?: string;
  formatted_address?: string;
  longitude?: number;
  latitude?: number;
  country_code?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ConciergeBookingDuration {
  hours: number;
  minutes: number;
}

export interface ConciergeBookingExtras {
  add_ons: unknown[];
  [key: string]: unknown;
}

export interface ConciergeBookingCreateRequest {
  customer_id: string;
  place_id: string;
  cleaner_id: string;
  schedule: number;
  extras: ConciergeBookingExtras;
  service: string;
  duration: ConciergeBookingDuration;
  custom_details: Record<string, unknown> | null;
}

export interface ConciergeBookingCreateResult {
  booking?: Record<string, unknown>;
  concierge_record?: Record<string, unknown>;
}

export interface AdminCreateCustomerPlaceRequest {
  admin_id: string;
  label: string;
  place_id: string;
  isDefault?: boolean;
}

export interface PlacesAutocompleteItem {
  place_id: string;
  name?: string;
  formatted_address?: string;
  description?: string;
  [key: string]: unknown;
}

export interface PlaceDetailsOut extends PlacesAutocompleteItem {
  longitude?: number;
  latitude?: number;
  country_code?: string;
}

export interface AdminResourceItem {
  id?: string;
  _id?: string;
  [key: string]: unknown;
}

export type AdminResourcePayload = Record<string, unknown>;
