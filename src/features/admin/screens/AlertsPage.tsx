"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { AlertCard } from "@/components/AlertCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAlerts, updateAlertAckState, updateAlertReadState } from "@/lib/api/admin-api";
import type { ApiError, MonitoringAlert } from "@/lib/api/types";

type TopFilter = "all" | "unread" | "unacknowledged";
type SeverityFilter = "all" | "critical" | "high" | "warning" | "info";

function filterAlerts(alerts: MonitoringAlert[], topFilter: TopFilter, severityFilter: SeverityFilter, query: string) {
  const normalized = query.trim().toLowerCase();
  return alerts.filter((alert) => {
    if (topFilter === "unread" && alert.is_read) return false;
    if (topFilter === "unacknowledged" && alert.ack_owner_id) return false;
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
    if (!normalized) return true;

    const haystack = [alert.title, alert.summary, alert.rule_key, alert.source_ip || "", alert.affected_user || ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

function toErrorMessage(error: unknown): string {
  const apiError = error as ApiError;
  if (apiError?.message) return apiError.message;
  return "Request failed.";
}

export default function AlertsPage() {
  const router = useRouter();
  const [topFilter, setTopFilter] = useState<TopFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());
  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(new Set());
  const [pendingAckIds, setPendingAckIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ["alerts", "center"],
    queryFn: () =>
      fetchAlerts({
        start: 0,
        stop: 80,
      }),
  });

  const markReadMutation = useMutation({
    mutationFn: ({ alertId, isRead }: { alertId: string; isRead: boolean; silent?: boolean }) => updateAlertReadState(alertId, isRead),
    onSuccess: async (_, variables) => {
      if (!variables.silent) toast.success("Alert state updated.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["overview", "alerts"] }),
      ]);
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  });

  const ackMutation = useMutation({
    mutationFn: ({ alertId, ack }: { alertId: string; ack: boolean; silent?: boolean }) => updateAlertAckState(alertId, ack),
    onSuccess: async (_, variables) => {
      if (!variables.silent) toast.success("Alert acknowledgement updated.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["overview", "alerts"] }),
      ]);
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  });

  const filteredAlerts = useMemo(
    () => filterAlerts(alertsQuery.data || [], topFilter, severityFilter, searchQuery),
    [alertsQuery.data, topFilter, severityFilter, searchQuery]
  );

  const selectedCount = selectedAlertIds.size;
  const selectionMode = selectedCount > 0;

  const toggleSelection = (alertId: string, selected: boolean) => {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(alertId);
      else next.delete(alertId);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedAlertIds(new Set());
  };

  const runBulk = async (runner: (alertId: string) => Promise<unknown>) => {
    try {
      await Promise.all(Array.from(selectedAlertIds).map((alertId) => runner(alertId)));
      clearSelection();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["overview", "alerts"] }),
      ]);
      return true;
    } catch (error) {
      toast.error(toErrorMessage(error));
      return false;
    }
  };

  const handleBulkMarkRead = async () => {
    const ok = await runBulk((alertId) => markReadMutation.mutateAsync({ alertId, isRead: true, silent: true }));
    if (ok) toast.success("Selected alerts marked as read.");
  };

  const handleBulkAcknowledge = async () => {
    const ok = await runBulk((alertId) => ackMutation.mutateAsync({ alertId, ack: true, silent: true }));
    if (ok) toast.success("Selected alerts acknowledged.");
  };

  const handleExportSelection = () => {
    const selected = filteredAlerts.filter((alert) => selectedAlertIds.has(alert._id));
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `alerts-export-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const handleRowReadToggle = async (alertId: string, isRead: boolean) => {
    setPendingReadIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
    try {
      await markReadMutation.mutateAsync({ alertId, isRead, silent: false });
    } catch {
      // handled in mutation onError
    } finally {
      setPendingReadIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const handleRowAckToggle = async (alertId: string, ack: boolean) => {
    setPendingAckIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
    try {
      await ackMutation.mutateAsync({ alertId, ack, silent: false });
    } catch {
      // handled in mutation onError
    } finally {
      setPendingAckIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-5 max-w-[1100px]">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tight">
        Alert Center
      </motion.h1>

      <AnimatePresence mode="wait">
        {!selectionMode ? (
          <motion.section
            key="filters"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="surface-card p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "unread", "unacknowledged"] as TopFilter[]).map((tab) => (
                <Button
                  key={tab}
                  variant={topFilter === tab ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTopFilter(tab)}
                  className="capitalize"
                >
                  {tab}
                </Button>
              ))}
              <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
              {(["all", "critical", "high", "warning", "info"] as SeverityFilter[]).map((level) => (
                <Button
                  key={level}
                  variant={severityFilter === level ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSeverityFilter(level)}
                  className="capitalize"
                >
                  {level}
                </Button>
              ))}
            </div>
            <div className="mt-3 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title, rule key, IP, or user..."
                className="pl-9"
              />
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="selection-toolbar"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="surface-card border-primary/30 bg-primary/5 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge variant="info">{selectedCount} items selected</Badge>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleBulkMarkRead} disabled={markReadMutation.isPending}>
                  Mark Read
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkAcknowledge} disabled={ackMutation.isPending}>
                  Acknowledge
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportSelection}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="space-y-3">
        {alertsQuery.isLoading && <p className="font-mono-data text-muted-foreground">Loading alerts...</p>}
        {alertsQuery.isError && <p className="font-mono-data text-destructive">Failed to fetch alerts.</p>}
        {!alertsQuery.isLoading && filteredAlerts.length === 0 && (
          <div className="surface-card p-8 text-center">
            <p className="text-label text-muted-foreground">No alerts match current filters.</p>
          </div>
        )}

        {filteredAlerts.map((alert, i) => (
          <AlertCard
            key={alert._id}
            alert={alert}
            index={i}
            selected={selectedAlertIds.has(alert._id)}
            showSelectionControl
            suppressRowActions={selectionMode}
            readActionPending={pendingReadIds.has(alert._id)}
            ackActionPending={pendingAckIds.has(alert._id)}
            onSelectToggle={toggleSelection}
            onReadToggle={handleRowReadToggle}
            onAcknowledge={handleRowAckToggle}
            onInvestigate={(alertId) => router.push(`/admin/security/audit?target_id=${encodeURIComponent(alertId)}`)}
          />
        ))}
      </section>
    </div>
  );
}
