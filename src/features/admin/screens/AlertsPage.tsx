"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fetchAlerts, updateAlertAckState, updateAlertReadState } from "@/lib/api/admin-api";
import type { MonitoringAlert } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StatusFilter = "all" | "open" | "acknowledged";
type SeverityFilter = "all" | "info" | "warning" | "high" | "critical";

function toDateTimeInput(epochSeconds?: number): string {
  if (!epochSeconds) return "";
  const date = new Date(epochSeconds * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateInput(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
}

function statusBadge(status: string) {
  if (status.toLowerCase().includes("ack")) return "secondary" as const;
  if (status.toLowerCase().includes("open")) return "warning" as const;
  return "outline" as const;
}

function severityBadge(severity: MonitoringAlert["severity"]) {
  if (severity === "critical") return "critical" as const;
  if (severity === "high") return "high" as const;
  if (severity === "warning") return "warning" as const;
  return "info" as const;
}

export default function AlertsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const alertsQuery = useQuery({
    queryKey: ["alerts", filter, unreadOnly],
    queryFn: () =>
      fetchAlerts({
        status: filter === "all" ? undefined : filter,
        unreadOnly,
        start: 0,
        stop: 100,
      }),
  });

  const markReadMutation = useMutation({
    mutationFn: ({ alertId, isRead }: { alertId: string; isRead: boolean }) => updateAlertReadState(alertId, isRead),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["open-alert-attention-count"] }),
        queryClient.invalidateQueries({ queryKey: ["overview", "alerts"] }),
      ]);
    },
  });

  const ackMutation = useMutation({
    mutationFn: ({ alertId, ack }: { alertId: string; ack: boolean }) => updateAlertAckState(alertId, ack),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["open-alert-attention-count"] }),
        queryClient.invalidateQueries({ queryKey: ["overview", "alerts"] }),
      ]);
    },
  });

  const filtered = useMemo(() => {
    const all = alertsQuery.data || [];
    const query = search.trim().toLowerCase();
    const from = fromDateInput(dateFrom);
    const to = fromDateInput(dateTo);

    return all.filter((alert) => {
      if (severity !== "all" && alert.severity !== severity) return false;
      if (query) {
        const haystack = `${alert.title} ${alert.summary} ${alert.rule_key} ${alert.source_ip || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      const fired = alert.last_fired_at || alert.date_created;
      if (from && fired < from) return false;
      if (to && fired > to) return false;
      return true;
    });
  }, [alertsQuery.data, dateFrom, dateTo, search, severity]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelected({});
      return;
    }

    setSelected(Object.fromEntries(filtered.map((alert) => [alert._id, true])));
  };

  const runBulkAction = async (type: "read" | "ack") => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one alert.");
      return;
    }

    try {
      if (type === "read") {
        await Promise.all(selectedIds.map((alertId) => updateAlertReadState(alertId, true)));
      } else {
        await Promise.all(selectedIds.map((alertId) => updateAlertAckState(alertId, true)));
      }
      toast.success(`${type === "read" ? "Marked as read" : "Acknowledged"} ${selectedIds.length} alerts.`);
      setSelected({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["open-alert-attention-count"] }),
        queryClient.invalidateQueries({ queryKey: ["overview", "alerts"] }),
      ]);
    } catch {
      toast.error("Bulk action failed.");
    }
  };

  return (
    <div className="space-y-5 max-w-[1200px]">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tighter">
        Alert Center
      </motion.h1>

      <div className="surface-card p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={filter} onValueChange={(value) => setFilter(value as StatusFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(value) => setSeverity(value as SeverityFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, rule key, summary, or IP" className="md:max-w-md" />
          <div className="flex items-center gap-2">
            <Button size="sm" variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly((prev) => !prev)}>
              Unread Only
            </Button>
            <Button size="sm" variant="outline" onClick={() => runBulkAction("read")}>Mark Read</Button>
            <Button size="sm" variant="outline" onClick={() => runBulkAction("ack")}>Acknowledge</Button>
          </div>
        </div>
      </div>

      <div className="surface-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[42px]">
                <Checkbox
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onCheckedChange={(value) => toggleAll(Boolean(value))}
                  aria-label="Select all alerts"
                />
              </TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Fired</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alertsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="font-mono-data text-muted-foreground">Loading alerts...</TableCell>
              </TableRow>
            )}
            {alertsQuery.isError && (
              <TableRow>
                <TableCell colSpan={7} className="font-mono-data text-destructive">Failed to fetch alerts.</TableCell>
              </TableRow>
            )}
            {!alertsQuery.isLoading && !alertsQuery.isError && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No alerts match current filters. Try widening date range or severity.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((alert) => (
              <TableRow key={alert._id}>
                <TableCell>
                  <Checkbox
                    checked={!!selected[alert._id]}
                    onCheckedChange={(value) => setSelected((prev) => ({ ...prev, [alert._id]: Boolean(value) }))}
                    aria-label={`Select alert ${alert.title}`}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={severityBadge(alert.severity)}>{alert.severity}</Badge>
                </TableCell>
                <TableCell className="font-mono-data text-xs">{alert.rule_key}</TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{alert.summary}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadge(alert.status)}>{alert.status}</Badge>
                </TableCell>
                <TableCell className="font-mono-data text-xs">{toDateTimeInput(alert.last_fired_at)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => markReadMutation.mutate({ alertId: alert._id, isRead: !alert.is_read })}>
                      {alert.is_read ? "Unread" : "Read"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => ackMutation.mutate({ alertId: alert._id, ack: !alert.ack_owner_id })}>
                      {alert.ack_owner_id ? "Unack" : "Ack"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(
                          `/admin/security/audit?preset=suspicious-login&endpoint=${encodeURIComponent("/v1/admins/monitoring/alerts")}&target=${encodeURIComponent(alert._id)}`
                        )
                      }
                    >
                      Investigate
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
