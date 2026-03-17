import { apiRequest } from "@/lib/api/client";
import type {
  AdminProfile,
  AdminLoginResponse,
  AlertSlaMetrics,
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
  MonitoringAlert,
  MonitoringOverview,
  PermissionCatalogResponse,
  RoleTemplate,
  RoleTemplatePreviewResult,
  RoleTemplateRolloutImpact,
  SessionRevokeResponse,
  SessionAnomalies,
  SignupTrendPoint,
  UsersSummaryReport,
} from "@/lib/api/types";

export async function loginAdmin(email: string, password: string) {
  const response = await apiRequest<AdminLoginResponse>("/v1/admins/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  return response.data;
}

export async function fetchAdminProfile() {
  const response = await apiRequest<AdminProfile>("/v1/admins/profile");
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
  return response.data;
}

export async function fetchRoleTemplate(role: "cleaner" | "customer") {
  const response = await apiRequest<RoleTemplate>(`/v1/admins/permission-templates/${role}`);
  return response.data;
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
