export const metricTooltips = {
  login_failures:
    "Number of unsuccessful authentication attempts via web and API in the last 60 minutes. Threshold for alert is >50/hr.",
  active_sessions: "Currently active admin sessions across all devices and locations.",
  open_alerts: "Unresolved security alerts requiring investigation or acknowledgment.",
  critical_high: "Count of critical and high severity alerts. Critical alerts require immediate action.",
  login_successes: "Successful authentication events in the last 60 minutes across all admin accounts.",
  refresh_failures:
    "Token rotation failures. High counts often indicate expired sessions or potential session hijacking attempts.",
  suspicious_logins:
    "Flagged logins based on geographic anomalies, known VPN exit nodes, or impossible travel speed.",
  mtta_mttr:
    "Mean Time to Acknowledge (seconds) vs Mean Time to Resolve (minutes). Benchmarked against your team's 30-day average.",
};
