"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Globe, Shield } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { AuthHeatmap } from "@/components/AuthHeatmap";
import { AlertCard } from "@/components/AlertCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchAlertSla,
  fetchAlerts,
  fetchAuthHeatmap,
  fetchMonitoringOverview,
  updateAlertAckState,
  updateAlertReadState,
} from "@/lib/api/admin-api";
import { metricTooltips } from "@/lib/admin-ui";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.2, 0, 0, 1] as const } },
};

export default function OverviewPage() {
  const router = useRouter();
  const [recentAlertFilter, setRecentAlertFilter] = useState<"all" | "unread" | "unacknowledged">("all");
  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(new Set());
  const [pendingAckIds, setPendingAckIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: fetchMonitoringOverview });
  const heatmapQuery = useQuery({ queryKey: ["overview", "heatmap"], queryFn: () => fetchAuthHeatmap(14) });
  const alertsQuery = useQuery({
    queryKey: ["overview", "alerts"],
    queryFn: () => fetchAlerts({ start: 0, stop: 4 }),
  });
  const openAlertAttentionQuery = useQuery({
    queryKey: ["open-alert-attention-count"],
    queryFn: () => fetchAlerts({ status: "open", unreadOnly: true, start: 0, stop: 99 }),
    refetchInterval: 30_000,
  });
  const slaQuery = useQuery({ queryKey: ["overview", "sla"], queryFn: () => fetchAlertSla(24) });
  const markReadMutation = useMutation({
    mutationFn: ({ alertId, isRead }: { alertId: string; isRead: boolean }) => updateAlertReadState(alertId, isRead),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["open-alert-attention-count"] }),
        queryClient.invalidateQueries({ queryKey: ["overview", "alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
      ]);
    },
  });
  const ackMutation = useMutation({
    mutationFn: ({ alertId, ack }: { alertId: string; ack: boolean }) => updateAlertAckState(alertId, ack),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["open-alert-attention-count"] }),
        queryClient.invalidateQueries({ queryKey: ["overview", "alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
      ]);
    },
  });

  const handleOverviewRowRead = async (alertId: string, isRead: boolean) => {
    setPendingReadIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
    try {
      await markReadMutation.mutateAsync({ alertId, isRead });
    } finally {
      setPendingReadIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const handleOverviewRowAck = async (alertId: string, ack: boolean) => {
    setPendingAckIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
    try {
      await ackMutation.mutateAsync({ alertId, ack });
    } finally {
      setPendingAckIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const ov = overviewQuery.data;
  const alertSla = slaQuery.data;
  const recentAlerts = useMemo(() => {
    const alerts = alertsQuery.data || [];
    if (recentAlertFilter === "unread") {
      return alerts.filter((alert) => !alert.is_read);
    }
    if (recentAlertFilter === "unacknowledged") {
      return alerts.filter((alert) => !alert.ack_owner_id);
    }
    return alerts;
  }, [alertsQuery.data, recentAlertFilter]);

  const threatSources = useMemo(() => {
    const grouped = new Map<string, { ip: string; hits: number; severity: "warning" | "high" | "critical"; label: string }>();
    for (const alert of recentAlerts) {
      if (!alert.source_ip) continue;
      const current = grouped.get(alert.source_ip);
      const severity = alert.severity === "critical" ? "critical" : alert.severity === "high" ? "high" : "warning";

      if (!current) {
        grouped.set(alert.source_ip, {
          ip: alert.source_ip,
          hits: 1,
          severity,
          label: alert.affected_user ? `User ${alert.affected_user}` : "Unknown",
        });
      } else {
        current.hits += 1;
        if (severity === "critical" || (severity === "high" && current.severity === "warning")) {
          current.severity = severity;
        }
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.hits - a.hits).slice(0, 5);
  }, [recentAlerts]);

  if (overviewQuery.isLoading) {
    return <p className="font-mono-data text-muted-foreground">Loading system overview...</p>;
  }

  if (overviewQuery.isError || !ov) {
    return <p className="font-mono-data text-destructive">Failed to load monitoring overview.</p>;
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tighter">System Overview</h1>
        <Badge variant="success" className="text-[11px]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse-dot" />
          Operational
        </Badge>
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Login Failures (1h)"
            value={ov.login_failures_last_hour}
            variant={ov.login_failures_last_hour > 10 ? "danger" : "success"}
            tooltip={metricTooltips.login_failures}
            anomaly={ov.login_failures_last_hour > 10}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Active Sessions"
            value={ov.active_admin_sessions}
            tooltip={metricTooltips.active_sessions}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="Open Alerts"
            value={openAlertAttentionQuery.data?.length ?? 0}
            variant={(openAlertAttentionQuery.data?.length ?? 0) > 5 ? "danger" : "default"}
            tooltip={metricTooltips.open_alerts}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <MetricCard
            label="MTTA / MTTR"
            value={alertSla ? `${Math.round(alertSla.mtta_seconds)}s / ${Math.round(alertSla.mttr_seconds / 60)}m` : "--"}
            tooltip={metricTooltips.mtta_mttr}
          />
        </motion.div>
      </motion.div>

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
              tooltip={metricTooltips.login_successes}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              label="Refresh Failures (1h)"
              value={ov.refresh_failures_last_hour}
              variant={ov.refresh_failures_last_hour > 5 ? "danger" : "default"}
              tooltip={metricTooltips.refresh_failures}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              label="Suspicious Logins (24h)"
              value={ov.suspicious_login_successes_last_day}
              variant={ov.suspicious_login_successes_last_day > 0 ? "danger" : "default"}
              tooltip={metricTooltips.suspicious_logins}
            />
          </motion.div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <AuthHeatmap items={heatmapQuery.data || []} />

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
            {threatSources.length === 0 && <p className="text-sm text-muted-foreground">No recent threat sources.</p>}
            {threatSources.map((source, i) => (
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
                  <Badge variant={source.severity === "critical" ? "critical" : source.severity === "high" ? "high" : "warning"} className="text-[10px]">
                    {source.severity}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-label text-muted-foreground">Recent Alerts</h2>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "unread", "unacknowledged"] as const).map((tab) => (
              <Button
                key={tab}
                size="sm"
                variant={recentAlertFilter === tab ? "default" : "outline"}
                onClick={() => setRecentAlertFilter(tab)}
                className="capitalize"
              >
                {tab}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          {recentAlerts.length === 0 && <p className="text-sm text-muted-foreground">No alerts for this view.</p>}
          {recentAlerts.map((alert, i) => (
            <AlertCard
              key={alert._id}
              alert={alert}
              index={i}
              readActionPending={pendingReadIds.has(alert._id)}
              ackActionPending={pendingAckIds.has(alert._id)}
              onAcknowledge={handleOverviewRowAck}
              onReadToggle={handleOverviewRowRead}
              onInvestigate={(alertId) => router.push(`/admin/security/audit?target_id=${encodeURIComponent(alertId)}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
