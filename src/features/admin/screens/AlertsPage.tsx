"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAlerts, updateAlertAckState, updateAlertReadState } from "@/lib/api/admin-api";
import type { ApiError, MonitoringAlert } from "@/lib/api/types";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { canAccessAdminAction } from "@/lib/admin-access";

type TopFilter = "all" | "unread" | "unacknowledged";
type SeverityFilter = "all" | "critical" | "high" | "warning" | "info";

function filterAlerts(
  alerts: MonitoringAlert[],
  topFilter: TopFilter,
  severityFilter: SeverityFilter,
  query: string
) {
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

function formatRelativeTime(epochSeconds: number) {
  const delta = Math.round((epochSeconds * 1000 - Date.now()) / 1000);
  const abs = Math.abs(delta);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(delta), "second");
  if (abs < 3600) return rtf.format(Math.round(delta / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(delta / 3600), "hour");
  return rtf.format(Math.round(delta / 86400), "day");
}

function severityBadgeVariant(severity: MonitoringAlert["severity"]) {
  if (severity === "critical") return "critical" as const;
  if (severity === "high") return "high" as const;
  if (severity === "warning") return "warning" as const;
  return "info" as const;
}

export default function AlertsPage() {
  const router = useRouter();
  const profileQuery = useAdminProfile();
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
    mutationFn: ({ alertId, isRead }: { alertId: string; isRead: boolean; silent?: boolean }) =>
      updateAlertReadState(alertId, isRead),
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
    mutationFn: ({ alertId, ack }: { alertId: string; ack: boolean; silent?: boolean }) =>
      updateAlertAckState(alertId, ack),
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

  const unreadCount = useMemo(() => (alertsQuery.data || []).filter((alert) => !alert.is_read).length, [alertsQuery.data]);
  const unackCount = useMemo(
    () => (alertsQuery.data || []).filter((alert) => !alert.ack_owner_id).length,
    [alertsQuery.data]
  );

  const allFilteredIds = useMemo(() => filteredAlerts.map((alert) => alert._id), [filteredAlerts]);
  const areAllFilteredSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedAlertIds.has(id));
  const selectedCount = selectedAlertIds.size;
  const selectionMode = selectedCount > 0;
  const canToggleRead = canAccessAdminAction(
    { method: "PATCH", path: "/v1/admins/monitoring/alerts/{alert_id}/read" },
    profileQuery.data
  );
  const canToggleAck = canAccessAdminAction(
    { method: "PATCH", path: "/v1/admins/monitoring/alerts/{alert_id}/ack" },
    profileQuery.data
  );

  const toggleSelection = (alertId: string, selected: boolean) => {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(alertId);
      else next.delete(alertId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    if (areAllFilteredSelected) {
      setSelectedAlertIds((prev) => {
        const next = new Set(prev);
        for (const id of allFilteredIds) next.delete(id);
        return next;
      });
      return;
    }
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      for (const id of allFilteredIds) next.add(id);
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
    } finally {
      setPendingAckIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto bg-white min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Alert Center</h1>
          <p className="text-sm text-gray-500 mt-1">Operational alert queue with bulk actions and investigation links.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => alertsQuery.refetch()}
            disabled={alertsQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <div className="flex items-center rounded-lg border bg-gray-50/50 p-1">
            <Badge variant="secondary" className="bg-transparent border-0 text-gray-700 font-medium px-3 h-7">
              {(alertsQuery.data || []).length} Total
            </Badge>
            <Badge className="bg-[#eef7ff] hover:bg-[#eef7ff] text-[#0ea5e9] border-0 px-3 h-7 font-medium">
              {unreadCount} Unread
            </Badge>
            <Badge className="bg-[#fff7ed] hover:bg-[#fff7ed] text-[#f97316] border-0 px-3 h-7 font-medium">
              {unackCount} Unack
            </Badge>
          </div>
        </div>
      </div>

      <div className="surface-card p-3 space-y-3">
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
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search title, rule key, IP, or user..."
            className="pl-9"
          />
        </div>
      </div>

      {selectionMode && (
        <section className="surface-card border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="info">{selectedCount} items selected</Badge>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkMarkRead} disabled={markReadMutation.isPending || !canToggleRead}>
                Mark Read
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkAcknowledge} disabled={ackMutation.isPending || !canToggleAck}>
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
        </section>
      )}

      <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow className="hover:bg-transparent border-b-gray-100">
              <TableHead className="w-12 px-4">
                <Checkbox
                  checked={areAllFilteredSelected}
                  onCheckedChange={toggleAllFiltered}
                  className="rounded border-gray-300 data-[state=checked]:bg-[#22c55e] data-[state=checked]:border-[#22c55e]"
                />
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Title</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Rule Key</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Severity</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">State</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Last Fired</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Source</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alertsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-gray-500 px-4 py-6">
                  Loading alerts...
                </TableCell>
              </TableRow>
            )}
            {alertsQuery.isError && (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-red-500 px-4 py-6">
                  Failed to fetch alerts.
                </TableCell>
              </TableRow>
            )}
            {!alertsQuery.isLoading && !alertsQuery.isError && filteredAlerts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-gray-500 px-4 py-6">
                  No alerts match current filters.
                </TableCell>
              </TableRow>
            )}
            {!alertsQuery.isLoading &&
              !alertsQuery.isError &&
              filteredAlerts.map((alert) => {
                const isUnread = !alert.is_read;
                const isAcked = !!alert.ack_owner_id;
                const readPending = pendingReadIds.has(alert._id);
                const ackPending = pendingAckIds.has(alert._id);
                return (
                  <TableRow key={alert._id} className="group hover:bg-gray-50/50 border-b-gray-100 transition-colors">
                    <TableCell className="px-4">
                      <Checkbox
                        checked={selectedAlertIds.has(alert._id)}
                        onCheckedChange={(checked) => toggleSelection(alert._id, !!checked)}
                        className="rounded border-gray-300 data-[state=checked]:bg-[#22c55e] data-[state=checked]:border-[#22c55e]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-gray-900 truncate">{alert.title}</span>
                        <span className="text-[11px] text-gray-400 leading-tight truncate">{alert.summary}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono-data text-xs text-gray-600">{alert.rule_key}</TableCell>
                    <TableCell>
                      <Badge variant={severityBadgeVariant(alert.severity)} className="uppercase tracking-[0.08em]">
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={isUnread ? "info" : "secondary"}>{isUnread ? "Unread" : "Read"}</Badge>
                        <Badge variant={isAcked ? "success" : "warning"}>{isAcked ? "Acknowledged" : "Unacknowledged"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatRelativeTime(alert.last_fired_at)}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                      <div>{alert.source_ip ? `IP: ${alert.source_ip}` : "-"}</div>
                      <div>{alert.affected_user ? `User: ${alert.affected_user}` : "-"}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={readPending || !canToggleRead}
                          onClick={() => handleRowReadToggle(alert._id, isUnread)}
                        >
                          {readPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isUnread ? "Mark Read" : "Mark Unread"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ackPending || !canToggleAck}
                          onClick={() => handleRowAckToggle(alert._id, !isAcked)}
                        >
                          {ackPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAcked ? "Unack" : "Ack"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-[#22c55e] hover:bg-[#e9f7ef]"
                          onClick={() => router.push(`/admin/security/audit?target_id=${encodeURIComponent(alert._id)}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
