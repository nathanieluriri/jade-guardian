import { MetricCard } from "@/components/MetricCard";
import { AuthHeatmap } from "@/components/AuthHeatmap";
import { AlertCard } from "@/components/AlertCard";
import { mockOverview, mockHeatmap, mockAlerts, mockAlertSLA } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

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
      {/* Title */}
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
      </motion.div>

      {/* Metric Cards */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Login Failures (1h)"
            value={ov.login_failures_last_hour}
            variant={ov.login_failures_last_hour > 10 ? "danger" : "success"}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Active Sessions"
            value={ov.active_admin_sessions}
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
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Critical / High"
            value={`${ov.critical_alert_count} / ${ov.high_alert_count}`}
            variant={ov.critical_alert_count > 0 ? "danger" : "default"}
          />
        </motion.div>
      </motion.div>

      {/* Secondary metrics */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div variants={fadeUp}>
          <MetricCard label="Login Successes (1h)" value={ov.login_success_last_hour} variant="success" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard label="Refresh Failures (1h)" value={ov.refresh_failures_last_hour} variant={ov.refresh_failures_last_hour > 5 ? "danger" : "default"} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard label="Suspicious Logins (24h)" value={ov.suspicious_login_successes_last_day} variant={ov.suspicious_login_successes_last_day > 0 ? "danger" : "default"} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="MTTA / MTTR"
            value={`${Math.round(mockAlertSLA.mtta_seconds)}s / ${Math.round(mockAlertSLA.mttr_seconds / 60)}m`}
          />
        </motion.div>
      </motion.div>

      {/* Heatmap */}
      <AuthHeatmap items={mockHeatmap.items} />

      {/* Recent Alerts */}
      <div>
        <h2 className="text-label text-muted-foreground mb-3">Recent Alerts</h2>
        <div className="grid gap-3">
          {mockAlerts.slice(0, 3).map((alert, i) => (
            <AlertCard key={alert._id} alert={alert} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
