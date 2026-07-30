import { apiRequest } from "@/lib/api/client";
import type {
  AdminAutocompleteUser,
  AdminCreateCustomerPlaceRequest,
  AdminCustomerPlaceOut,
  AdminElevationRequestStatus,
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

export async function loginAdmin(email: string, password: string) {
  const response = await apiRequest<AdminLoginResponse>("/v1/admins/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

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

export async function listElevationRequests(params: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  start?: number;
  stop?: number;
} = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  search.set("start", String(params.start ?? 0));
  search.set("stop", String(params.stop ?? 50));
  const response = await apiRequest<ElevationRequestItem[]>(`/v1/admins/access/requests?${search.toString()}`);
  return response.data || [];
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

export async function fetchAlerts(params: {
  status?: string;
  unreadOnly?: boolean;
  start?: number;
  stop?: number;
}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.unreadOnly !== undefined) search.set("unreadOnly", String(params.unreadOnly));
  search.set("start", String(params.start ?? 0));
  search.set("stop", String(params.stop ?? 20));

  const response = await apiRequest<MonitoringAlert[]>(`/v1/admins/monitoring/alerts?${search.toString()}`);
  return response.data || [];
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

export async function fetchSessionAnomalies() {
  const response = await apiRequest<SessionAnomalies>("/v1/admins/monitoring/sessions/anomalies");
  return response.data;
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

export async function listAuditHistory(filters: AuditHistoryFilters = {}) {
  const search = new URLSearchParams();
  const entries = Object.entries(filters) as Array<[keyof AuditHistoryFilters, AuditHistoryFilters[keyof AuditHistoryFilters]]>;

  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "tags" && Array.isArray(value)) {
      if (value.length > 0) search.set("tags", value.join(","));
      continue;
    }
    search.set(String(key), String(value));
  }

  if (!search.has("sort")) search.set("sort", "desc");
  if (!search.has("cursor")) {
    if (!search.has("start")) search.set("start", "0");
    if (!search.has("stop")) search.set("stop", "20");
  }

  const response = await apiRequest<AuditHistoryResponse>(`/v1/admins/monitoring/audit/history?${search.toString()}`);
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

export async function listAdmins(start = 0, stop = 100) {
  const response = await apiRequest<AdminProfile[]>(`/v1/admins/?start=${start}&stop=${stop}`);
  return response.data || [];
}

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

export async function listCleaners(start = 0, stop = 100) {
  const response = await apiRequest<CleanerListItem[]>(`/v1/admins/cleaners?start=${start}&stop=${stop}`);
  return response.data || [];
}

export async function listOnboardingQueue(start = 0, stop = 50, sort = "submitted_at") {
  const response = await apiRequest<CleanerListItem[]>(
    `/v1/admins/onboarding/queue?start=${start}&stop=${stop}&sort=${encodeURIComponent(sort)}`
  );
  return response.data || [];
}

export async function fetchCleanerById(cleanerId: string) {
  const response = await apiRequest<CleanerListItem>(`/v1/admins/cleaners/${cleanerId}`);
  return response.data;
}

export async function listCustomers(start = 0, stop = 100) {
  const response = await apiRequest<CustomerListItem[]>(`/v1/admins/customers?start=${start}&stop=${stop}`);
  return response.data || [];
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

export async function listAdminCustomerPlaces(customerId: string, start = 0, stop = 20) {
  const search = new URLSearchParams();
  search.set("start", String(start));
  search.set("stop", String(stop));
  const response = await apiRequest<AdminCustomerPlaceOut[]>(
    `/v1/admins/customers/${customerId}/places?${search.toString()}`
  );
  return Array.isArray(response.data) ? response.data : [];
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

async function listAdminResource(path: string, start = 0, stop = 100) {
  const response = await apiRequest<AdminResourceItem[] | { items?: AdminResourceItem[] }>(
    `${path}?start=${start}&stop=${stop}`
  );
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

export async function listServiceDefinitions(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/service-definitions/", start, stop);
}

export async function createServiceDefinition(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/service-definitions/", payload);
}

export async function updateServiceDefinition(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/service-definitions/${id}`, payload);
}

export async function deleteServiceDefinition(id: string) {
  return deleteAdminResource(`/v1/admins/service-definitions/${id}`);
}

export async function listAddOns(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/add-ons/", start, stop);
}

export async function createAddOn(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/add-ons/", payload);
}

export async function updateAddOn(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/add-ons/${id}`, payload);
}

export async function deleteAddOn(id: string) {
  return deleteAdminResource(`/v1/admins/add-ons/${id}`);
}

export async function listPricingRules(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/pricing-rules/", start, stop);
}

export async function createPricingRule(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/pricing-rules/", payload);
}

export async function updatePricingRule(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/pricing-rules/${id}`, payload);
}

export async function deletePricingRule(id: string) {
  return deleteAdminResource(`/v1/admins/pricing-rules/${id}`);
}

export async function listServiceAreas(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/service-areas/", start, stop);
}

export async function createServiceArea(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/service-areas/", payload);
}

export async function updateServiceArea(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/service-areas/${id}`, payload);
}

export async function deleteServiceArea(id: string) {
  return deleteAdminResource(`/v1/admins/service-areas/${id}`);
}

export async function listPromoCodes(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/promo-codes/", start, stop);
}

export async function createPromoCode(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/promo-codes/", payload);
}

export async function updatePromoCode(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/promo-codes/${id}`, payload);
}

export async function deletePromoCode(id: string) {
  return deleteAdminResource(`/v1/admins/promo-codes/${id}`);
}

export async function listConciergeBookings(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/concierge-bookings/", start, stop);
}

export async function createConciergeBooking(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/concierge-bookings/", payload);
}

export async function updateConciergeBooking(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/concierge-bookings/${id}`, payload);
}

export async function deleteConciergeBooking(id: string) {
  return deleteAdminResource(`/v1/admins/concierge-bookings/${id}`);
}

export async function listChatInterventions(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/chat-interventions/", start, stop);
}

export async function createChatIntervention(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/chat-interventions/", payload);
}

export async function updateChatIntervention(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/chat-interventions/${id}`, payload);
}

export async function deleteChatIntervention(id: string) {
  return deleteAdminResource(`/v1/admins/chat-interventions/${id}`);
}

export async function listClaimReviews(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/claim-reviews/", start, stop);
}

export async function createClaimReview(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/claim-reviews/", payload);
}

export async function updateClaimReview(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/claim-reviews/${id}`, payload);
}

export async function deleteClaimReview(id: string) {
  return deleteAdminResource(`/v1/admins/claim-reviews/${id}`);
}

export async function listServiceCredits(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/service-credits/", start, stop);
}

export async function createServiceCredit(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/service-credits/", payload);
}

export async function updateServiceCredit(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/service-credits/${id}`, payload);
}

export async function deleteServiceCredit(id: string) {
  return deleteAdminResource(`/v1/admins/service-credits/${id}`);
}

export async function listPayoutAdjustments(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/payout-adjustments/", start, stop);
}

export async function createPayoutAdjustment(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/payout-adjustments/", payload);
}

export async function updatePayoutAdjustment(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/payout-adjustments/${id}`, payload);
}

export async function deletePayoutAdjustment(id: string) {
  return deleteAdminResource(`/v1/admins/payout-adjustments/${id}`);
}

export async function listBroadcasts(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/broadcasts/", start, stop);
}

export async function createBroadcast(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/broadcasts/", payload);
}

export async function updateBroadcast(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/broadcasts/${id}`, payload);
}

export async function deleteBroadcast(id: string) {
  return deleteAdminResource(`/v1/admins/broadcasts/${id}`);
}

export async function listCleanerTags(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/cleaner-tags/", start, stop);
}

export async function createCleanerTag(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/cleaner-tags/", payload);
}

export async function updateCleanerTag(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/cleaner-tags/${id}`, payload);
}

export async function deleteCleanerTag(id: string) {
  return deleteAdminResource(`/v1/admins/cleaner-tags/${id}`);
}

export async function listAvailabilityOverrides(start = 0, stop = 100) {
  return listAdminResource("/v1/admins/availability-overrides/", start, stop);
}

export async function createAvailabilityOverride(payload: AdminResourcePayload) {
  return createAdminResource("/v1/admins/availability-overrides/", payload);
}

export async function updateAvailabilityOverride(id: string, payload: AdminResourcePayload) {
  return updateAdminResource(`/v1/admins/availability-overrides/${id}`, payload);
}

export async function deleteAvailabilityOverride(id: string) {
  return deleteAdminResource(`/v1/admins/availability-overrides/${id}`);
}
