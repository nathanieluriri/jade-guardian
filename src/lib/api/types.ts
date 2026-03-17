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

export interface AdminProfile {
  id: string;
  full_name?: string;
  email?: string;
  permissionList?: {
    permissions: Array<{ name: string; methods: string[]; path: string; key?: string; description?: string }>;
  };
}

export interface AdminLoginResponse {
  access_token: string;
  refresh_token: string;
}

export interface AdminRefreshResponse {
  access_token: string;
  refresh_token: string;
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
