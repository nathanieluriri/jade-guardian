// Mock data for the admin dashboard

export const mockOverview = {
  login_failures_last_hour: 12,
  login_success_last_hour: 95,
  refresh_failures_last_hour: 4,
  open_alert_count: 6,
  high_alert_count: 2,
  critical_alert_count: 1,
  active_admin_sessions: 8,
  suspicious_login_successes_last_day: 2,
};

export const mockHeatmap = {
  items: Array.from({ length: 168 }, (_, i) => ({
    day_of_week: Math.floor(i / 24),
    hour_of_day: i % 24,
    success_count: Math.floor(Math.random() * 40),
    failure_count: Math.floor(Math.random() * 8),
  })),
};

export const mockAlerts: Array<{
  _id: string;
  rule_key: string;
  dedup_key: string;
  severity: "info" | "warning" | "high" | "critical";
  title: string;
  summary: string;
  details: Record<string, unknown>;
  actor_id: string;
  status: "open" | "acknowledged" | "resolved";
  is_read: boolean;
  ack_owner_id: string | null;
  ack_at: number | null;
  last_fired_at: number;
  date_created: number;
}> = [
  {
    _id: "alert_001",
    rule_key: "admin_bruteforce_window",
    dedup_key: "admin_bruteforce:192.168.1.100",
    severity: "critical",
    title: "Possible brute-force login activity",
    summary: "Detected 18 failed login attempts from 192.168.1.100 in the last 15 minutes.",
    details: { ip: "192.168.1.100", attempts: 18 },
    actor_id: "unknown",
    status: "open",
    is_read: false,
    ack_owner_id: null,
    ack_at: null,
    last_fired_at: Date.now() / 1000 - 120,
    date_created: Date.now() / 1000 - 300,
  },
  {
    _id: "alert_002",
    rule_key: "admin_suspicious_success",
    dedup_key: "admin_suspicious_success:admin_003",
    severity: "high",
    title: "Suspicious login success after repeated failures",
    summary: "Admin admin_003 succeeded login after 7 consecutive failures within 10 minutes.",
    details: { admin_id: "admin_003", prior_failures: 7 },
    actor_id: "admin_003",
    status: "open",
    is_read: false,
    ack_owner_id: null,
    ack_at: null,
    last_fired_at: Date.now() / 1000 - 600,
    date_created: Date.now() / 1000 - 900,
  },
  {
    _id: "alert_003",
    rule_key: "admin_impossible_travel",
    dedup_key: "admin_impossible_travel:admin_005",
    severity: "high",
    title: "Impossible travel detected",
    summary: "Admin admin_005 logged in from Lagos, Nigeria and then London, UK within 12 minutes.",
    details: { admin_id: "admin_005", locations: ["Lagos, Nigeria", "London, UK"], gap_minutes: 12 },
    actor_id: "admin_005",
    status: "open",
    is_read: true,
    ack_owner_id: null,
    ack_at: null,
    last_fired_at: Date.now() / 1000 - 1800,
    date_created: Date.now() / 1000 - 2400,
  },
  {
    _id: "alert_004",
    rule_key: "admin_first_seen_device",
    dedup_key: "admin_first_seen_device:admin_001",
    severity: "info",
    title: "First-seen device fingerprint",
    summary: "Admin admin_001 authenticated from a previously unseen device fingerprint.",
    details: { admin_id: "admin_001", fingerprint: "fp_abc123def" },
    actor_id: "admin_001",
    status: "acknowledged",
    is_read: true,
    ack_owner_id: "admin_002",
    ack_at: Date.now() / 1000 - 3600,
    last_fired_at: Date.now() / 1000 - 7200,
    date_created: Date.now() / 1000 - 7200,
  },
  {
    _id: "alert_005",
    rule_key: "admin_session_spike",
    dedup_key: "admin_session_spike:global",
    severity: "warning",
    title: "Global admin session creation spike",
    summary: "14 new admin sessions created in the last 5 minutes, exceeding the threshold of 10.",
    details: { count: 14, threshold: 10, window_minutes: 5 },
    actor_id: "system",
    status: "open",
    is_read: false,
    ack_owner_id: null,
    ack_at: null,
    last_fired_at: Date.now() / 1000 - 180,
    date_created: Date.now() / 1000 - 400,
  },
  {
    _id: "alert_006",
    rule_key: "admin_token_replay",
    dedup_key: "admin_token_replay:admin_007",
    severity: "warning",
    title: "Possible token replay detected",
    summary: "Refresh token for admin_007 was used from two different IPs within 30 seconds.",
    details: { admin_id: "admin_007", ips: ["10.0.0.1", "10.0.0.2"] },
    actor_id: "admin_007",
    status: "open",
    is_read: true,
    ack_owner_id: null,
    ack_at: null,
    last_fired_at: Date.now() / 1000 - 500,
    date_created: Date.now() / 1000 - 700,
  },
];

export const mockSessionAnomalies = {
  active_sessions_by_admin: {
    admin_001: 3,
    admin_002: 1,
    admin_003: 5,
    admin_005: 2,
    admin_007: 4,
  } as Record<string, number>,
  global_active_sessions: 15,
  long_lived_session_count: 2,
  recent_session_spike_detected: true,
};

export const mockAlertSLA = {
  mtta_seconds: 180.5,
  mttr_seconds: 1200.2,
  acknowledged_count: 11,
  resolved_count: 7,
};

export const mockDeniedPermissions = {
  items: [
    { permission_key: "GET:/admins/monitoring/overview", deny_count: 14, admins: ["admin_004", "admin_006"] },
    { permission_key: "POST:/admins/sessions/revoke-all", deny_count: 8, admins: ["admin_004"] },
    { permission_key: "PATCH:/admins/cleaners/onboarding-review", deny_count: 5, admins: ["admin_006", "admin_008"] },
    { permission_key: "PUT:/admins/permission-templates/cleaner", deny_count: 3, admins: ["admin_004"] },
  ],
};

export const mockAuditEvents = [
  {
    id: "evt_001",
    event_type: "ADMIN_LOGIN_FAILURE",
    severity: "warning",
    actor: { actor_id: "unknown", actor_role: "admin", actor_email: "a***n@example.com" },
    target: { target_id: "admin_003", target_type: "admin" },
    request: { request_id: "req_001", endpoint: "admin_login", method: "POST", path: "/v1/admins/login", ip: "192.168.1.100", geo_hint: "Lagos, Nigeria" },
    status_code: 401,
    reason: "Invalid credentials",
    date_created: Date.now() / 1000 - 120,
    date_created_iso_utc: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "evt_002",
    event_type: "ADMIN_LOGIN_SUCCESS",
    severity: "info",
    actor: { actor_id: "admin_001", actor_role: "admin", actor_email: "j***e@example.com" },
    target: { target_id: "admin_001", target_type: "admin" },
    request: { request_id: "req_002", endpoint: "admin_login", method: "POST", path: "/v1/admins/login", ip: "10.0.0.5", geo_hint: "San Francisco, US" },
    status_code: 200,
    reason: null,
    date_created: Date.now() / 1000 - 300,
    date_created_iso_utc: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "evt_003",
    event_type: "ADMIN_SESSION_REVOKED",
    severity: "info",
    actor: { actor_id: "admin_002", actor_role: "admin", actor_email: "m***k@example.com" },
    target: { target_id: "admin_003", target_type: "admin" },
    request: { request_id: "req_003", endpoint: "revoke_others", method: "POST", path: "/v1/admins/sessions/revoke-others", ip: "10.0.0.10", geo_hint: "London, UK" },
    status_code: 200,
    reason: null,
    date_created: Date.now() / 1000 - 600,
    date_created_iso_utc: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: "evt_004",
    event_type: "ADMIN_PERMISSION_DENIED",
    severity: "warning",
    actor: { actor_id: "admin_004", actor_role: "admin", actor_email: "t***t@example.com" },
    target: { target_id: "admin_004", target_type: "admin" },
    request: { request_id: "req_004", endpoint: "get_monitoring_overview", method: "GET", path: "/v1/admins/monitoring/overview", ip: "172.16.0.5", geo_hint: "Berlin, DE" },
    status_code: 403,
    reason: "Missing permission key GET:/admins/monitoring/overview",
    date_created: Date.now() / 1000 - 900,
    date_created_iso_utc: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: "evt_005",
    event_type: "ADMIN_PERMISSION_ROLLOUT",
    severity: "info",
    actor: { actor_id: "admin_001", actor_role: "admin", actor_email: "j***e@example.com" },
    target: { target_id: "cleaner", target_type: "role" },
    request: { request_id: "req_005", endpoint: "rollout_permissions", method: "POST", path: "/v1/admins/permission-templates/cleaner/rollout", ip: "10.0.0.5", geo_hint: "San Francisco, US" },
    status_code: 200,
    reason: null,
    date_created: Date.now() / 1000 - 3600,
    date_created_iso_utc: new Date(Date.now() - 3600000).toISOString(),
  },
];
