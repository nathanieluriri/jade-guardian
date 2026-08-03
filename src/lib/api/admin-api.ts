import { apiRequest } from "@/lib/api/client";
import type {
  AdminAutocompleteUser,
  AdminCreateCustomerPlaceRequest,
  AdminCustomerPlaceOut,
  AdminElevationRequestStatus,
  AdminListParams,
  AdminPermissionGroup,
  AdminPermissionGroupsResponse,
  AdminProfile,
  AdminResourceItem,
  AdminResourcePayload,
  ConciergeBookingCreateRequest,
  ConciergeBookingCreateResult,
  DecideElevationRequestPayload,
  DecideElevationResponse,
  AdminLoginResponse,
  AccessPresetBulkResult,
  AccessPresetSummary,
  AlertSlaMetrics,
  PlaceDetailsOut,
  PlacesAutocompleteItem,
  AuditEvent,
  AuditExportCreateRequest,
  AuditExportJob,
  AuditHistoryFilters,
  AuditHistoryResponse,
  AuditRedaction,
  AuthHeatmapCell,
  CleanerListItem,
  CustomerListItem,
  CreateAdminRequest,
  DeniedPermissionItem,
  ElevationRequestItem,
  MonitoringAlert,
  MonitoringOverview,
  PermissionCatalogResponse,
  RoleTemplate,
  RoleTemplatePreviewResult,
  RoleTemplateRolloutImpact,
  SessionRevokeResponse,
  SubmitElevationRequestPayload,
  SessionAnomalies,
  SignupTrendPoint,
  TotpBackupCodesData,
  TotpSetupData,
  UsersSummaryReport,
} from "@/lib/api/types";
import type {
  BroadcastAudience,
  BroadcastCreateRequest,
  BroadcastListOut,
  BroadcastOut,
  AudiencePreviewOut,
} from "@/lib/api/broadcast-types";

function normalizePermissionEntry(input: unknown): RoleTemplate["permissionList"]["permissions"][number] | null {
  if (!input || typeof input !== "object") return null;

  const item = input as {
    name?: unknown;
    key?: unknown;
    methods?: unknown;
    path?: unknown;
    description?: unknown;
  };

  const key = typeof item.key === "string" ? item.key : "";
  const methods =
    Array.isArray(item.methods) && item.methods.every((m) => typeof m === "string")
      ? (item.methods as string[])
      : [];
  const path = typeof item.path === "string" ? item.path : "";
  const name = typeof item.name === "string" ? item.name : key || path || "permission";
  const description = typeof item.description === "string" ? item.description : undefined;

  if (!key && (!methods.length || !path)) return null;

  return {
    name,
    key: key || `${methods[0] || "GET"}:${path}`,
    methods: methods.length ? methods : [key.split(":")[0] || "GET"],
    path: path || key.split(":").slice(1).join(":") || "/",
    description,
  };
}

function normalizeRoleTemplateResponse(role: "cleaner" | "customer", raw: unknown): RoleTemplate {
  const data = (raw && typeof raw === "object" ? raw : {}) as {
    role?: unknown;
    source?: unknown;
    permissionList?: unknown;
    permission_list?: unknown;
    permissions?: unknown;
  };

  const candidatePermissions =
    (data.permissionList &&
    typeof data.permissionList === "object" &&
    Array.isArray((data.permissionList as { permissions?: unknown }).permissions)
      ? (data.permissionList as { permissions: unknown[] }).permissions
      : null) ||
    (data.permission_list &&
    typeof data.permission_list === "object" &&
    Array.isArray((data.permission_list as { permissions?: unknown }).permissions)
      ? (data.permission_list as { permissions: unknown[] }).permissions
      : null) ||
    (Array.isArray(data.permissionList) ? data.permissionList : null) ||
    (Array.isArray(data.permissions) ? data.permissions : null) ||
    [];

  const permissions = candidatePermissions
    .map((item) => normalizePermissionEntry(item))
    .filter((item): item is RoleTemplate["permissionList"]["permissions"][number] => item !== null);

  return {
    role: data.role === "cleaner" || data.role === "customer" ? data.role : role,
    source: typeof data.source === "string" ? data.source : undefined,
    permissionList: {
      permissions,
    },
  };
}

function normalizePermissionCatalogResponse(raw: unknown): PermissionCatalogResponse {
  const data = (raw && typeof raw === "object" ? raw : {}) as PermissionCatalogResponse & {
    groups?: PermissionCatalogResponse["grouped"];
    grouped_permissions?: PermissionCatalogResponse["grouped"];
  };

  const groupedCandidate = data.grouped || data.groups || data.grouped_permissions || [];
  const grouped = Array.isArray(groupedCandidate)
    ? groupedCandidate.filter((group) => group && typeof group === "object")
    : [];

  const flatPermissionsCandidate =
    data.flat && typeof data.flat === "object" && Array.isArray(data.flat.permissions) ? data.flat.permissions : [];
  const flatPermissions = flatPermissionsCandidate.filter((permission) => permission && typeof permission === "object");

  return {
    grouped,
    flat: { permissions: flatPermissions },
  };
}

function normalizeAdminResourceListResponse(raw: unknown): AdminResourceItem[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is AdminResourceItem => !!item && typeof item === "object");
  }
  if (!raw || typeof raw !== "object") return [];
  const envelope = raw as { items?: unknown; data?: unknown };
  if (Array.isArray(envelope.items)) {
    return envelope.items.filter((item): item is AdminResourceItem => !!item && typeof item === "object");
  }
  if (Array.isArray(envelope.data)) {
    return envelope.data.filter((item): item is AdminResourceItem => !!item && typeof item === "object");
  }
  return [];
}

function normalizeAdminAutocompleteUsers(input: unknown): AdminAutocompleteUser[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is AdminAutocompleteUser => !!item && typeof item === "object");
}

function normalizePlaces(input: unknown): PlacesAutocompleteItem[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is PlacesAutocompleteItem => !!item && typeof item === "object");
}

/**
 * Starts a login. `auth: false` for the same reason as `verifyAdminOtp` below:
 * there is no session to rotate yet, so the refresh-and-replay path can only do
 * harm — a wrong password (401 `INVALID_CREDENTIALS`) used to trigger a refresh
 * and then *replay the login*, recording two failed attempts server-side for
 * one human attempt and burning the rate-limit/lockout budget (and the audit
 * trail) twice as fast. It also leaves any unrelated existing auth hint alone.
 */
export async function loginAdmin(email: string, password: string) {
  const response = await apiRequest<AdminLoginResponse>(
    "/v1/admins/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { auth: false }
  );

  return response.data;
}

/**
 * Completes an OTP challenge issued by `loginAdmin`. There is no session
 * cookie yet at this point, so `auth: false` skips the pointless
 * refresh-and-retry dance on a 401/429 (OTP_INVALID/OTP_EXPIRED/OTP_LOCKED)
 * and leaves any unrelated existing auth hint alone.
 */
export async function verifyAdminOtp(challengeId: string, code: string) {
  const response = await apiRequest<AdminLoginResponse>(
    "/v1/admins/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({ challengeId, code }),
    },
    { auth: false }
  );

  return response.data;
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const response = await apiRequest<{ ok: boolean }>("/v1/admins/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return response.data;
}

export async function logoutAdmin() {
  const response = await apiRequest<{ ok: boolean }>("/v1/admins/logout", { method: "POST" });
  return response.data;
}

/** Begins (or restarts) TOTP enrollment. `code` is required only when TOTP is already enabled. */
export async function setupTotp(code?: string) {
  const response = await apiRequest<TotpSetupData>("/v1/admins/2fa/setup", {
    method: "POST",
    body: JSON.stringify(code ? { code } : {}),
  });
  return response.data;
}

export async function verifyTotp(code: string) {
  const response = await apiRequest<TotpBackupCodesData>("/v1/admins/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return response.data;
}

export async function disableTotp(code: string) {
  // Backend responds with an intentionally empty object (`envelopeOf(z.object({}))`).
  const response = await apiRequest<Record<string, never>>("/v1/admins/2fa", {
    method: "DELETE",
    body: JSON.stringify({ code }),
  });
  return response.data;
}

export async function regenerateBackupCodes(code: string) {
  const response = await apiRequest<TotpBackupCodesData>("/v1/admins/2fa/backup-codes/regenerate", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return response.data;
}

export async function inviteAdmin(payload: { email: string; fullName: string; accessPreset: string }) {
  const response = await apiRequest<AdminProfile>("/v1/admins/invites", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function resendAdminInvite(adminId: string) {
  const response = await apiRequest<AdminProfile>(`/v1/admins/invites/${adminId}/resend`, {
    method: "POST",
  });
  return response.data;
}

/**
 * Backend wraps the catalog in `{ items: [...] }` (`AccessPresetCatalogOut`) — not
 * a bare array. Unwrap here so callers (Task 6's `.map()`) get the array directly.
 */
export async function listAccessPresets() {
  const response = await apiRequest<{ items: AccessPresetSummary[] }>("/v1/admins/access-presets");
  return response.data.items;
}

export async function setAdminAccessPreset(adminId: string, preset: string) {
  const response = await apiRequest<AdminProfile>(`/v1/admins/${adminId}/access-preset`, {
    method: "PATCH",
    body: JSON.stringify({ preset }),
  });
  return response.data;
}

export async function bulkSetAdminAccessPreset(adminIds: string[], preset: string) {
  const response = await apiRequest<AccessPresetBulkResult>("/v1/admins/access-presets/bulk", {
    method: "POST",
    body: JSON.stringify({ adminIds, preset }),
  });
  return response.data;
}

export async function fetchAdminProfile() {
  const response = await apiRequest<AdminProfile>("/v1/admins/profile");
  return response.data;
}

export async function fetchPermissionGroups() {
  const response = await apiRequest<
    AdminPermissionGroup[] | { items?: AdminPermissionGroup[] } | AdminPermissionGroupsResponse
  >(
    "/v1/admins/access/permission-groups"
  );
  if (Array.isArray(response.data)) return response.data;
  if ("builtIn" in response.data || "custom" in response.data) {
    const builtIn = response.data.builtIn || [];
    const custom = response.data.custom || [];
    return [...builtIn, ...custom];
  }
  if ("items" in response.data) {
    return response.data.items || [];
  }
  return [];
}

export async function createPermissionGroup(payload: {
  name: string;
  description?: string;
  permissions: string[];
}) {
  const response = await apiRequest<AdminPermissionGroup>("/v1/admins/access/permission-groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function submitElevationRequest(payload: SubmitElevationRequestPayload) {
  return apiRequest("/v1/admins/access/request-elevation", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchElevationRequestStatus() {
  const response = await apiRequest<AdminElevationRequestStatus>("/v1/admins/access/request-elevation/status");
  return response.data;
}

/**
 * Backend wraps this in the shared `GenericList` envelope (`{ items, total }`), not a bare array.
 * The route only forwards `limit`/`skip` from the shared `AdminListQuery` schema — `search` is
 * declared there but unused by this particular route, so it isn't sent.
 */
export async function listElevationRequests(params: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  limit?: number;
  skip?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("limit", String(params.limit ?? 50));
  query.set("skip", String(params.skip ?? 0));
  const response = await apiRequest<{ items?: ElevationRequestItem[] }>(`/v1/admins/access/requests?${query.toString()}`);
  return response.data?.items ?? [];
}

export async function decideElevationRequest(requestId: string, payload: DecideElevationRequestPayload) {
  const response = await apiRequest<DecideElevationResponse>(`/v1/admins/access/requests/${requestId}/decision`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function fetchMonitoringOverview() {
  const response = await apiRequest<MonitoringOverview>("/v1/admins/monitoring/overview");
  return response.data;
}

export async function fetchAuthHeatmap(days = 14) {
  const response = await apiRequest<{ items?: AuthHeatmapCell[] } | AuthHeatmapCell[]>(
    `/v1/admins/monitoring/auth/heatmap?days=${days}`
  );
  if (Array.isArray(response.data)) return response.data;
  return response.data?.items || [];
}

/**
 * Backend wraps this in the shared `GenericList` envelope (`{ items, total }`), not a bare array.
 * The route only forwards `limit`/`skip` from the shared `AdminListQuery` schema. `status` and
 * `unreadOnly` aren't part of that schema and are already silently dropped server-side — a
 * distinct, pre-existing issue from the pagination param mismatch this fixes, left alone here.
 */
export async function fetchAlerts(params: {
  status?: string;
  unreadOnly?: boolean;
  limit?: number;
  skip?: number;
}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.unreadOnly !== undefined) query.set("unreadOnly", String(params.unreadOnly));
  query.set("limit", String(params.limit ?? 20));
  query.set("skip", String(params.skip ?? 0));

  const response = await apiRequest<{ items?: MonitoringAlert[] }>(`/v1/admins/monitoring/alerts?${query.toString()}`);
  return response.data?.items ?? [];
}

export async function updateAlertReadState(alertId: string, isRead: boolean) {
  return apiRequest(`/v1/admins/monitoring/alerts/${alertId}/read`, {
    method: "PATCH",
    body: JSON.stringify({ is_read: isRead }),
  });
}

export async function updateAlertAckState(alertId: string, ack: boolean) {
  return apiRequest(`/v1/admins/monitoring/alerts/${alertId}/ack`, {
    method: "PATCH",
    body: JSON.stringify({ ack }),
  });
}

/**
 * The spec types this endpoint's `data` as a passthrough `AdminGenericObject`, so the
 * `SessionAnomalies` interface is a claim the runtime does not honor. Normalizing here
 * rather than in the component keeps every consumer safe: SessionsPage previously white-
 * screened on `Object.entries(undefined)`.
 */
export async function fetchSessionAnomalies(): Promise<SessionAnomalies> {
  const response = await apiRequest<Partial<SessionAnomalies> | null>(
    "/v1/admins/monitoring/sessions/anomalies",
  );
  const data = (response.data ?? {}) as Partial<SessionAnomalies>;

  const rawCounts = data.active_sessions_by_admin;
  const active_sessions_by_admin: Record<string, number> = {};
  if (rawCounts && typeof rawCounts === "object" && !Array.isArray(rawCounts)) {
    for (const [adminId, count] of Object.entries(rawCounts)) {
      if (typeof count === "number" && Number.isFinite(count)) {
        active_sessions_by_admin[adminId] = count;
      }
    }
  }

  return {
    active_sessions_by_admin,
    global_active_sessions: typeof data.global_active_sessions === "number" ? data.global_active_sessions : 0,
    long_lived_session_count: typeof data.long_lived_session_count === "number" ? data.long_lived_session_count : 0,
    recent_session_spike_detected: data.recent_session_spike_detected === true,
  };
}

export async function revokeCurrentSession() {
  return apiRequest<SessionRevokeResponse>("/v1/admins/sessions/logout", { method: "POST" });
}

export async function revokeOtherSessions() {
  return apiRequest<SessionRevokeResponse>("/v1/admins/sessions/revoke-others", { method: "POST" });
}

export async function revokeAllSessions() {
  return apiRequest<SessionRevokeResponse>("/v1/admins/sessions/revoke-all", { method: "POST" });
}

export async function fetchAlertSla(hours = 24) {
  const response = await apiRequest<AlertSlaMetrics>(`/v1/admins/monitoring/alerts/sla?hours=${hours}`);
  return response.data;
}

export async function fetchDeniedPermissions(hours = 24, limit = 10) {
  const response = await apiRequest<{ items?: DeniedPermissionItem[] } | DeniedPermissionItem[]>(
    `/v1/admins/monitoring/permissions/denied-top?hours=${hours}&limit=${limit}`
  );
  if (Array.isArray(response.data)) return response.data;
  return response.data?.items || [];
}

export async function fetchPermissionCatalog() {
  const response = await apiRequest<PermissionCatalogResponse>("/v1/admins/permissions/catalog");
  return normalizePermissionCatalogResponse(response.data);
}

export async function fetchRoleTemplate(role: "cleaner" | "customer") {
  const response = await apiRequest<RoleTemplate | Record<string, unknown>>(`/v1/admins/permission-templates/${role}`);
  return normalizeRoleTemplateResponse(role, response.data);
}

export async function updateRoleTemplate(role: "cleaner" | "customer", permissions: RoleTemplate["permissionList"]) {
  return apiRequest(`/v1/admins/permission-templates/${role}`, {
    method: "PUT",
    body: JSON.stringify({ permissionList: permissions }),
  });
}

export async function previewRoleTemplate(role: "cleaner" | "customer", permissions: RoleTemplate["permissionList"]) {
  const response = await apiRequest<RoleTemplatePreviewResult>(`/v1/admins/permission-templates/${role}/preview`, {
    method: "POST",
    body: JSON.stringify({ permissionList: permissions }),
  });
  return response.data;
}

export async function getRoleRolloutImpact(role: "cleaner" | "customer") {
  const response = await apiRequest<RoleTemplateRolloutImpact>(`/v1/admins/permission-templates/${role}/rollout-impact`);
  return response.data;
}

export async function rolloutRoleTemplate(role: "cleaner" | "customer") {
  return apiRequest(`/v1/admins/permission-templates/${role}/rollout`, { method: "POST" });
}

export async function createAuditExportJob(payload: AuditExportCreateRequest) {
  const response = await apiRequest<AuditExportJob>("/v1/admins/monitoring/audit/export", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getAuditExportJob(exportId: string) {
  const response = await apiRequest<AuditExportJob>(`/v1/admins/monitoring/audit/export/${exportId}`);
  return response.data;
}

export function getAuditExportDownloadUrl(exportId: string) {
  return `/v1/admins/monitoring/audit/export/${exportId}/download`;
}

export async function exportAuditLog(payload: {
  actor_id?: string | null;
  target_id?: string | null;
  endpoint?: string | null;
  from_epoch?: number | null;
  to_epoch?: number | null;
  limit?: number;
}) {
  return createAuditExportJob(payload);
}

/**
 * The `/monitoring/audit/history` route only reads `limit`/`skip` from the shared
 * `AdminListQuery` schema, so this function's own `start`/`stop` pagination fields (kept as-is
 * here — renaming them would ripple through `AuditPage.tsx`'s URL-synced filter state, which is
 * outside this fix's scope) are sent on the wire as `skip`/`limit`. Every other filter (actor_id,
 * target_id, cursor, tags, etc.) isn't part of that schema either and was already a no-op
 * server-side before this fix — left alone, same as `fetchAlerts`'s `status`/`unreadOnly`.
 */
export async function listAuditHistory(filters: AuditHistoryFilters = {}) {
  const query = new URLSearchParams();
  const entries = Object.entries(filters) as Array<[keyof AuditHistoryFilters, AuditHistoryFilters[keyof AuditHistoryFilters]]>;

  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "start" || key === "stop") continue;
    if (key === "tags" && Array.isArray(value)) {
      if (value.length > 0) query.set("tags", value.join(","));
      continue;
    }
    query.set(String(key), String(value));
  }

  if (!query.has("sort")) query.set("sort", "desc");
  if (!query.has("cursor")) {
    query.set("skip", String(filters.start ?? 0));
    query.set("limit", String(filters.stop ?? 20));
  }

  const response = await apiRequest<AuditHistoryResponse>(`/v1/admins/monitoring/audit/history?${query.toString()}`);
  return response.data;
}

export async function getAuditEventById(
  eventId: string,
  options: { include_payload?: boolean; include_related?: boolean; redaction?: AuditRedaction } = {}
) {
  const search = new URLSearchParams();
  if (options.include_payload !== undefined) search.set("include_payload", String(options.include_payload));
  if (options.include_related !== undefined) search.set("include_related", String(options.include_related));
  if (options.redaction) search.set("redaction", options.redaction);
  const suffix = search.toString() ? `?${search.toString()}` : "";

  const response = await apiRequest<AuditEvent>(`/v1/admins/monitoring/audit/history/${eventId}${suffix}`);
  return response.data;
}

/**
 * Backend wraps this in the shared `GenericList` envelope (`{ items, total }`), not a bare array
 * — same pattern as `listCleaners`/`listCustomers`/etc. `search` is accepted by the shared
 * `AdminListQuery` schema but unused by this route's service (`adminRepo.listAdmins` doesn't
 * support it), so it isn't sent. No trailing slash: Hono's router is strict, and a route
 * registered at `path: '/'` mounted at `/api/v1/admins` matches only `GET /api/v1/admins`,
 * never `GET /api/v1/admins/`.
 */
export async function listAdmins(params: { limit?: number; skip?: number } = {}) {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 100));
  query.set("skip", String(params.skip ?? 0));
  const response = await apiRequest<{ items?: AdminProfile[] }>(`/v1/admins?${query.toString()}`);
  return response.data?.items ?? [];
}

/**
 * @deprecated The backend marks `POST /admins/signup` deprecated in favour of
 * the invite flow (`inviteAdmin`), which generates and emails a temporary
 * password and forces a change on first login. Kept only for the legacy
 * bootstrap path; no screen calls it.
 */
export async function createAdmin(payload: CreateAdminRequest) {
  const response = await apiRequest<AdminProfile>("/v1/admins/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteOwnAdminAccount() {
  return apiRequest("/v1/admins/account", { method: "DELETE" });
}

export async function reviewCleanerOnboarding(
  cleanerId: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  return apiRequest(`/v1/admins/cleaners/${cleanerId}/onboarding-review`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      rejection_reason: status === "REJECTED" ? rejectionReason || null : null,
    }),
  });
}

/**
 * Backend wraps this in the shared `GenericList` envelope (`{ items, total }`), not a bare array.
 * `search` is forwarded — the `/cleaners` route passes it through to the directory service.
 */
export async function listCleaners(params: AdminListParams = {}) {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 100));
  query.set("skip", String(params.skip ?? 0));
  if (params.search) query.set("search", params.search);
  const response = await apiRequest<{ items?: CleanerListItem[] }>(`/v1/admins/cleaners?${query.toString()}`);
  return response.data?.items ?? [];
}

/**
 * Backend wraps this in the shared `GenericList` envelope (`{ items, total }`), not a bare array.
 * `search` is forwarded — the `/onboarding/queue` route passes it through to the directory
 * service. The old `sort` param was never part of the backend's `AdminListQuery` schema and the
 * route discarded it before it ever reached the service, so it's dropped rather than carried
 * forward as dead weight.
 */
export async function listOnboardingQueue(params: AdminListParams = {}) {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 50));
  query.set("skip", String(params.skip ?? 0));
  if (params.search) query.set("search", params.search);
  const response = await apiRequest<{ items?: CleanerListItem[] }>(`/v1/admins/onboarding/queue?${query.toString()}`);
  return response.data?.items ?? [];
}

export async function fetchCleanerById(cleanerId: string) {
  const response = await apiRequest<CleanerListItem>(`/v1/admins/cleaners/${cleanerId}`);
  return response.data;
}

/**
 * Backend wraps this in the shared `GenericList` envelope (`{ items, total }`), not a bare array.
 * `search` is forwarded — the `/customers` route passes it through to the directory service.
 */
export async function listCustomers(params: AdminListParams = {}) {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 100));
  query.set("skip", String(params.skip ?? 0));
  if (params.search) query.set("search", params.search);
  const response = await apiRequest<{ items?: CustomerListItem[] }>(`/v1/admins/customers?${query.toString()}`);
  return response.data?.items ?? [];
}

export async function fetchCustomerById(customerId: string) {
  const response = await apiRequest<CustomerListItem>(`/v1/admins/customers/${customerId}`);
  return response.data;
}

export async function autocompleteAdminUsers(query: string, limit = 10) {
  const search = new URLSearchParams();
  search.set("q", query);
  search.set("limit", String(limit));
  const response = await apiRequest<{ customers?: unknown; cleaners?: unknown }>(
    `/v1/admins/users/autocomplete?${search.toString()}`
  );
  return {
    customers: normalizeAdminAutocompleteUsers(response.data?.customers),
    cleaners: normalizeAdminAutocompleteUsers(response.data?.cleaners),
  };
}

/**
 * Backend wraps this in the shared `GenericList` envelope (`{ items, total }`), not a bare
 * array — the route handler even forces it through `GenericList.parse()`. The old
 * `Array.isArray(response.data)` guard was always false against a real backend, so this
 * always returned `[]`.
 */
export async function listAdminCustomerPlaces(customerId: string, params: { limit?: number; skip?: number } = {}) {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 20));
  query.set("skip", String(params.skip ?? 0));
  const response = await apiRequest<{ items?: AdminCustomerPlaceOut[] }>(
    `/v1/admins/customers/${customerId}/places?${query.toString()}`
  );
  return response.data?.items ?? [];
}

export async function createAdminCustomerPlace(customerId: string, payload: AdminCreateCustomerPlaceRequest) {
  const response = await apiRequest<Record<string, unknown>>(`/v1/admins/customers/${customerId}/places`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function autocompletePlaces(query: string, limit = 10) {
  const search = new URLSearchParams();
  // Backend contract uses `input` for places autocomplete.
  // Keep `q` as a compatibility mirror for older deployments.
  search.set("input", query);
  search.set("q", query);
  search.set("limit", String(limit));
  const response = await apiRequest<PlacesAutocompleteItem[] | { items?: PlacesAutocompleteItem[] }>(
    `/v1/places/autocomplete?${search.toString()}`
  );
  if (Array.isArray(response.data)) return normalizePlaces(response.data);
  return normalizePlaces(response.data?.items || []);
}

export async function getPlaceDetails(placeId: string) {
  const search = new URLSearchParams();
  search.set("place_id", placeId);
  const response = await apiRequest<PlaceDetailsOut>(`/v1/places/details?${search.toString()}`);
  return response.data;
}

export async function createConciergeBookingByAdmin(payload: ConciergeBookingCreateRequest) {
  const response = await apiRequest<ConciergeBookingCreateResult>("/v1/admins/concierge-bookings/create-booking", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function fetchUsersSummaryReport() {
  const response = await apiRequest<UsersSummaryReport>("/v1/admins/reports/users/summary");
  return response.data;
}

export async function fetchUsersSignupTrend() {
  const response = await apiRequest<SignupTrendPoint[] | { items?: SignupTrendPoint[] }>(
    "/v1/admins/reports/users/signups-trend"
  );
  if (Array.isArray(response.data)) return response.data;
  return response.data?.items || [];
}

/**
 * Backing helper for the resource CRUD list functions below (service definitions, add-ons,
 * pricing rules, etc.). These routes are backed by the backend's generic `FeatureListQuery`
 * schema (`app/server/schemas/admin-features.ts`), which only defines `limit`/`skip` — no
 * `search` — so none of the wrapper functions accept it either.
 *
 * Callers below must pass `path` with no trailing slash, same as `listAdmins` above: every
 * one of these resources is mounted in the backend via `crudRouter()`
 * (`app/server/routes/admin-features/_crud.ts`), whose `GET`/`POST` handlers are registered
 * at `path: '/'`. Hono's router is strict, so `/api/v1/admins/<resource>` matches but
 * `/api/v1/admins/<resource>/` 404s.
 */
async function listAdminResource(path: string, params: { limit?: number; skip?: number } = {}) {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 100));
  query.set("skip", String(params.skip ?? 0));
  const response = await apiRequest<AdminResourceItem[] | { items?: AdminResourceItem[] }>(`${path}?${query.toString()}`);
  return normalizeAdminResourceListResponse(response.data);
}

async function createAdminResource(path: string, payload: AdminResourcePayload) {
  const response = await apiRequest<AdminResourceItem>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

async function updateAdminResource(path: string, payload: AdminResourcePayload) {
  const response = await apiRequest<AdminResourceItem>(path, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

async function deleteAdminResource(path: string) {
  return apiRequest(path, { method: "DELETE" });
}

export async function listServiceDefinitions(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/service-definitions", params);
}

export async function createServiceDefinition(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/service-definitions", payload);
}

export async function updateServiceDefinition(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/service-definitions/${id}`, payload);
}

export async function deleteServiceDefinition(id: string) {
  return deleteAdminResource(`/v1/admins/service-definitions/${id}`);
}

export async function listAddOns(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/add-ons", params);
}

export async function createAddOn(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/add-ons", payload);
}

export async function updateAddOn(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/add-ons/${id}`, payload);
}

export async function deleteAddOn(id: string) {
  return deleteAdminResource(`/v1/admins/add-ons/${id}`);
}

export async function listPricingRules(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/pricing-rules", params);
}

export async function createPricingRule(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/pricing-rules", payload);
}

export async function updatePricingRule(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/pricing-rules/${id}`, payload);
}

export async function deletePricingRule(id: string) {
  return deleteAdminResource(`/v1/admins/pricing-rules/${id}`);
}

export async function listServiceAreas(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/service-areas", params);
}

export async function createServiceArea(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/service-areas", payload);
}

export async function updateServiceArea(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/service-areas/${id}`, payload);
}

export async function deleteServiceArea(id: string) {
  return deleteAdminResource(`/v1/admins/service-areas/${id}`);
}

export async function listPromoCodes(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/promo-codes", params);
}

export async function createPromoCode(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/promo-codes", payload);
}

export async function updatePromoCode(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/promo-codes/${id}`, payload);
}

export async function deletePromoCode(id: string) {
  return deleteAdminResource(`/v1/admins/promo-codes/${id}`);
}

export async function listConciergeBookings(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/concierge-bookings", params);
}

export async function createConciergeBooking(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/concierge-bookings", payload);
}

export async function updateConciergeBooking(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/concierge-bookings/${id}`, payload);
}

export async function deleteConciergeBooking(id: string) {
  return deleteAdminResource(`/v1/admins/concierge-bookings/${id}`);
}

export async function listChatInterventions(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/chat-interventions", params);
}

export async function createChatIntervention(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/chat-interventions", payload);
}

export async function updateChatIntervention(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/chat-interventions/${id}`, payload);
}

export async function deleteChatIntervention(id: string) {
  return deleteAdminResource(`/v1/admins/chat-interventions/${id}`);
}

export async function listClaimReviews(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/claim-reviews", params);
}

export async function createClaimReview(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/claim-reviews", payload);
}

export async function updateClaimReview(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/claim-reviews/${id}`, payload);
}

export async function deleteClaimReview(id: string) {
  return deleteAdminResource(`/v1/admins/claim-reviews/${id}`);
}

export async function listServiceCredits(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/service-credits", params);
}

export async function createServiceCredit(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/service-credits", payload);
}

export async function updateServiceCredit(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/service-credits/${id}`, payload);
}

export async function deleteServiceCredit(id: string) {
  return deleteAdminResource(`/v1/admins/service-credits/${id}`);
}

export async function listPayoutAdjustments(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/payout-adjustments", params);
}

export async function createPayoutAdjustment(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/payout-adjustments", payload);
}

export async function updatePayoutAdjustment(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/payout-adjustments/${id}`, payload);
}

export async function deletePayoutAdjustment(id: string) {
  return deleteAdminResource(`/v1/admins/payout-adjustments/${id}`);
}

/**
 * Client for the real notification broadcast API (`/v1/admins/notifications/broadcasts`),
 * which actually fans out pushes/notifications — unlike the legacy `/v1/admins/broadcasts`
 * CRUD collection, which just wrote a row (retired; no longer exported from this file).
 *
 * `listNotificationBroadcasts` is cursor-paginated (`cursor`/`pageSize` in,
 * `{ items, nextCursor, pageSize }` out), unlike every other admin list in this file.
 * Do NOT route it through `listAdminResource` (which hardcodes `limit`/`skip`) and do NOT
 * flatten its response to a bare array — callers need `nextCursor` to page.
 */
export async function fetchNotificationTypes() {
  const response = await apiRequest<string[]>("/v1/admins/notifications/types");
  return response.data;
}

export async function previewBroadcastAudience(audience: BroadcastAudience, type?: string) {
  const query = new URLSearchParams();
  if (type !== undefined) query.set("type", type);
  // `?${query.toString()}` unconditionally (empty string when `type` is absent) rather
  // than a `path` variable — same convention as listAdmins/listCleaners/etc. above. This
  // keeps a single call site with the query built inline as one literal, so the
  // path-parity audit (which only matches a literal passed directly to `apiRequest`,
  // not one assigned to a variable first) still sees this route.
  const response = await apiRequest<AudiencePreviewOut>(
    `/v1/admins/notifications/broadcasts/preview?${query.toString()}`,
    {
      method: "POST",
      body: JSON.stringify(audience),
    }
  );
  return response.data;
}

export async function createBroadcast_v2(payload: BroadcastCreateRequest) {
  const response = await apiRequest<BroadcastOut>("/v1/admins/notifications/broadcasts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function listNotificationBroadcasts(params: { cursor?: string; pageSize?: number } = {}) {
  const query = new URLSearchParams();
  if (params.cursor !== undefined) query.set("cursor", params.cursor);
  if (params.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  const path = qs ? `/v1/admins/notifications/broadcasts?${qs}` : `/v1/admins/notifications/broadcasts`;
  const response = await apiRequest<BroadcastListOut>(path);
  return response.data;
}

export async function fetchNotificationBroadcast(id: string) {
  const response = await apiRequest<BroadcastOut>(`/v1/admins/notifications/broadcasts/${id}`);
  return response.data;
}

export async function resumeBroadcast(id: string) {
  const response = await apiRequest<BroadcastOut>(`/v1/admins/notifications/broadcasts/${id}/resume`, {
    method: "POST",
  });
  return response.data;
}

export async function cancelBroadcast(id: string) {
  const response = await apiRequest<BroadcastOut>(`/v1/admins/notifications/broadcasts/${id}/cancel`, {
    method: "POST",
  });
  return response.data;
}

export async function listCleanerTags(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/cleaner-tags", params);
}

export async function createCleanerTag(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/cleaner-tags", payload);
}

export async function updateCleanerTag(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/cleaner-tags/${id}`, payload);
}

export async function deleteCleanerTag(id: string) {
  return deleteAdminResource(`/v1/admins/cleaner-tags/${id}`);
}

export async function listAvailabilityOverrides(params: { limit?: number; skip?: number } = {}) {
  return listAdminResource("/v1/admins/availability-overrides", params);
}

export async function createAvailabilityOverride(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/availability-overrides", payload);
}

export async function updateAvailabilityOverride(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/availability-overrides/${id}`, payload);
}

export async function deleteAvailabilityOverride(id: string) {
  return deleteAdminResource(`/v1/admins/availability-overrides/${id}`);
}
