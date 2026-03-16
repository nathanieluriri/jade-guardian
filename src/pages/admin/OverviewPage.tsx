import { MetricCard } from "@/components/MetricCard";
import { AuthHeatmap } from "@/components/AuthHeatmap";
import { AlertCard } from "@/components/AlertCard";
import {
  mockOverview,
  mockHeatmap,
  mockHeatmapLatency,
  mockHeatmapTraffic,
  mockAlerts,
  mockAlertSLA,
  mockSparklines,
  mockTrends,
  mockMetricTooltips,
  mockThreatSources,
} from "@/lib/mock-data";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Globe, Shield } from "lucide-react";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.2, 0, 0, 1] as const } },
};

export default function OverviewPage() {
  const ov = mockOverview;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Title + Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-baseline gap-3"
      >
        <h1 className="text-2xl font-semibold tracking-tighter">System Overview</h1>
        <Badge variant="success" className="text-[11px]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse-dot" />
          Operational
        </Badge>
        <span className="text-xs text-muted-foreground font-mono-data ml-1">
          Last checked: 2 mins ago
        </span>
      </motion.div>

      {/* Hero Metric Cards — 4 columns */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Login Failures (1h)"
            value={ov.login_failures_last_hour}
            variant={ov.login_failures_last_hour > 10 ? "danger" : "success"}
            tooltip={mockMetricTooltips.login_failures}
            sparkline={mockSparklines.login_failures}
            trend={mockTrends.login_failures}
            anomaly={ov.login_failures_last_hour > 10}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Active Sessions"
            value={ov.active_admin_sessions}
            tooltip={mockMetricTooltips.active_sessions}
            sparkline={mockSparklines.active_sessions}
            trend={mockTrends.active_sessions}
            suffix={
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
                Live
              </span>
            }
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Open Alerts"
            value={ov.open_alert_count}
            variant={ov.open_alert_count > 5 ? "danger" : "default"}
            tooltip={mockMetricTooltips.open_alerts}
            sparkline={mockSparklines.open_alerts}
            trend={mockTrends.open_alerts}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="MTTA / MTTR"
            value={`${Math.round(mockAlertSLA.mtta_seconds)}s / ${Math.round(mockAlertSLA.mttr_seconds / 60)}m`}
            tooltip={mockMetricTooltips.mtta_mttr}
            trend={mockTrends.mtta_mttr}
          />
        </motion.div>
      </motion.div>

      {/* Secondary metrics — Performance cluster */}
      <div>
        <h2 className="text-label text-muted-foreground mb-2 flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" />
          Performance
        </h2>
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <motion.div variants={fadeUp}>
            <MetricCard
              label="Login Successes (1h)"
              value={ov.login_success_last_hour}
              variant="success"
              tooltip={mockMetricTooltips.login_successes}
              sparkline={mockSparklines.login_successes}
              trend={mockTrends.login_successes}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              label="Refresh Failures (1h)"
              value={ov.refresh_failures_last_hour}
              variant={ov.refresh_failures_last_hour > 5 ? "danger" : "default"}
              tooltip={mockMetricTooltips.refresh_failures}
              sparkline={mockSparklines.refresh_failures}
              trend={mockTrends.refresh_failures}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              label="Suspicious Logins (24h)"
              value={ov.suspicious_login_successes_last_day}
              variant={ov.suspicious_login_successes_last_day > 0 ? "danger" : "default"}
              tooltip={mockMetricTooltips.suspicious_logins}
              sparkline={mockSparklines.suspicious_logins}
              trend={mockTrends.suspicious_logins}
            />
          </motion.div>
        </motion.div>
      </div>

      {/* 70/30 split: Heatmap + Threat Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <AuthHeatmap
          items={mockHeatmap.items}
          latencyItems={mockHeatmapLatency.items}
          trafficItems={mockHeatmapTraffic.items}
        />

        {/* Top Threat Sources */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15, ease: [0.2, 0, 0, 1] }}
          className="surface-card p-4"
        >
          <h3 className="text-label text-muted-foreground mb-3 flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" />
            Top Threat Sources
          </h3>
          <div className="space-y-2">
            {mockThreatSources.map((source, i) => (
              <motion.div
                key={source.ip}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05, duration: 0.25 }}
                className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-mono-data text-foreground">{source.ip}</p>
                  <p className="text-[11px] text-muted-foreground">{source.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-data text-foreground font-medium">{source.hits}</span>
                  <Badge
                    variant={source.severity === "critical" ? "critical" : source.severity === "high" ? "high" : "warning"}
                    className="text-[10px]"
                  >
                    {source.severity}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Alerts */}
      <div>
        <h2 className="text-label text-muted-foreground mb-3">Recent Alerts</h2>
        <div className="grid gap-3">
          {mockAlerts.slice(0, 4).map((alert, i) => (
            <AlertCard key={alert._id} alert={alert} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
