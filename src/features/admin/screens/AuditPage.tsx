"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createAuditExportJob,
  getAuditEventById,
  getAuditExportDownloadUrl,
  getAuditExportJob,
  listAuditHistory,
} from "@/lib/api/admin-api";
import { getAuthState } from "@/lib/api/auth-storage";
import type { AuditEvent, AuditExportJob, AuditHistoryFilters } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type AuditPreset = "all" | "suspicious-login" | "permission-denials" | "onboarding-decisions";

const PRESET_TO_EVENT_TYPES: Record<Exclude<AuditPreset, "all">, string[]> = {
  "suspicious-login": ["admin_login_failed", "admin_login_succeeded"],
  "permission-denials": ["permission_denied"],
  "onboarding-decisions": ["cleaner_onboarding_reviewed"],
};

function parseIntOrDefault(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function serializeUrlState(pathname: string, state: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(state).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  return `${pathname}?${search.toString()}`;
}

function eventStatusVariant(status?: string) {
  if (!status) return "secondary" as const;
  if (status === "denied" || status === "failed") return "warning" as const;
  if (status === "critical") return "high" as const;
  return "secondary" as const;
}

function severityVariant(severity?: string) {
  if (!severity) return "secondary" as const;
  if (severity === "critical") return "critical" as const;
  if (severity === "high") return "high" as const;
  if (severity === "warning") return "warning" as const;
  return "info" as const;
}

export default function AuditPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [preset, setPreset] = useState<AuditPreset>((searchParams.get("preset") as AuditPreset) || "all");
  const [cursor, setCursor] = useState<string | null>(searchParams.get("cursor"));
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const [start, setStart] = useState(parseIntOrDefault(searchParams.get("start"), 0));
  const [stop, setStop] = useState(parseIntOrDefault(searchParams.get("stop"), 20));
  const [actorId, setActorId] = useState(searchParams.get("actor_id") || "");
  const [targetId, setTargetId] = useState(searchParams.get("target") || searchParams.get("target_id") || "");
  const [endpoint, setEndpoint] = useState(searchParams.get("endpoint") || "");
  const [eventType, setEventType] = useState(searchParams.get("event_type") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [severity, setSeverity] = useState(searchParams.get("severity") || "");
  const [fromEpoch, setFromEpoch] = useState(searchParams.get("from_epoch") || "");
  const [toEpoch, setToEpoch] = useState(searchParams.get("to_epoch") || "");

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRedaction, setDetailRedaction] = useState<"strict" | "standard" | "none">("strict");

  const [exportJob, setExportJob] = useState<AuditExportJob | null>(null);

  const queryEventType = useMemo(() => {
    if (preset === "all") return eventType || undefined;
    if (eventType) return eventType;
    return PRESET_TO_EVENT_TYPES[preset].join(",");
  }, [eventType, preset]);

  const filters: AuditHistoryFilters = useMemo(
    () => ({
      cursor: cursor || undefined,
      start,
      stop,
      sort: "desc",
      actor_id: actorId || undefined,
      target_id: targetId || undefined,
      endpoint: endpoint || undefined,
      event_type: queryEventType || undefined,
      status: status || undefined,
      severity: severity || undefined,
      from_epoch: fromEpoch ? Number(fromEpoch) : undefined,
      to_epoch: toEpoch ? Number(toEpoch) : undefined,
      include_payload: false,
      include_related: false,
    }),
    [actorId, cursor, endpoint, fromEpoch, queryEventType, severity, start, status, stop, targetId, toEpoch]
  );

  useEffect(() => {
    const next = serializeUrlState(pathname, {
      preset,
      cursor,
      start,
      stop,
      actor_id: actorId,
      target_id: targetId,
      endpoint,
      event_type: eventType,
      status,
      severity,
      from_epoch: fromEpoch,
      to_epoch: toEpoch,
    });
    router.replace(next, { scroll: false });
  }, [actorId, cursor, endpoint, eventType, fromEpoch, pathname, preset, router, severity, start, status, stop, targetId, toEpoch]);

  const historyQuery = useQuery({
    queryKey: ["audit-history", filters],
    queryFn: () => listAuditHistory(filters),
  });

  const eventDetailQuery = useQuery({
    queryKey: ["audit-event-detail", selectedEventId, detailRedaction],
    enabled: !!selectedEventId,
    queryFn: () => getAuditEventById(selectedEventId as string, { include_payload: true, include_related: true, redaction: detailRedaction }),
  });

  const exportCreateMutation = useMutation({
    mutationFn: () =>
      createAuditExportJob({
        actor_id: actorId || null,
        target_id: targetId || null,
        endpoint: endpoint || null,
        event_type: queryEventType || null,
        status: status || null,
        severity: severity || null,
        from_epoch: fromEpoch ? Number(fromEpoch) : null,
        to_epoch: toEpoch ? Number(toEpoch) : null,
        format: "csv",
        include_payload: false,
        include_related: false,
        limit: 5000,
      }),
    onSuccess: (job) => setExportJob(job),
  });

  const exportStatusQuery = useQuery({
    queryKey: ["audit-export-job", exportJob?.export_id],
    enabled: !!exportJob?.export_id,
    queryFn: () => getAuditExportJob(exportJob!.export_id),
    refetchInterval: (query) => {
      const state = query.state.data as AuditExportJob | undefined;
      if (!state) return 5000;
      return state.status === "queued" || state.status === "processing" ? 5000 : false;
    },
  });

  const activeJob = exportStatusQuery.data || exportJob;

  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (!activeJob?.export_id) throw new Error("No export job available");
      const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
      const relative = activeJob.download_url || getAuditExportDownloadUrl(activeJob.export_id);
      const url = relative.startsWith("http") ? relative : `${baseUrl}${relative}`;
      const token = getAuthState()?.accessToken || "";

      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 409) throw new Error("Export is not ready yet.");
      if (response.status === 410) throw new Error("Export expired. Generate a new export.");
      if (!response.ok) throw new Error("Download failed.");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `audit-export-${activeJob.export_id}.csv`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    },
  });

  const pagination = historyQuery.data?.pagination;
  const items = historyQuery.data?.items || [];

  return (
    <div className="space-y-5 max-w-[1200px]">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tighter">
        Audit Center
      </motion.h1>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <div className="surface-card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "All" },
                { key: "suspicious-login", label: "Suspicious login" },
                { key: "permission-denials", label: "Permission denials" },
                { key: "onboarding-decisions", label: "Onboarding decisions" },
              ].map((option) => (
                <Button
                  key={option.key}
                  variant={preset === option.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setPreset(option.key as AuditPreset);
                    setCursor(null);
                    setCursorHistory([]);
                  }}
                >
                  {option.label}
                </Button>
              ))}
              <Badge variant="secondary">Total: {pagination?.total ?? items.length}</Badge>
              {historyQuery.data?.query && <Badge variant="outline">Query normalized</Badge>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              <Input value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="actor_id" />
              <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="target_id" />
              <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="endpoint" />
              <Input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="event_type (snake_case)" />
              <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="status" />
              <Input value={severity} onChange={(e) => setSeverity(e.target.value)} placeholder="severity" />
              <Input value={fromEpoch} onChange={(e) => setFromEpoch(e.target.value)} placeholder="from_epoch" />
              <Input value={toEpoch} onChange={(e) => setToEpoch(e.target.value)} placeholder="to_epoch" />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCursor(null);
                  setCursorHistory([]);
                  setStart(0);
                  setStop(20);
                }}
              >
                Reset paging
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (cursorHistory.length === 0) return;
                  const next = [...cursorHistory];
                  const prevCursor = next.pop() || null;
                  setCursorHistory(next);
                  setCursor(prevCursor);
                }}
                disabled={cursorHistory.length === 0}
              >
                Previous cursor
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const nextCursor = pagination?.next_cursor;
                  if (!nextCursor) return;
                  setCursorHistory((prev) => [...prev, cursor || ""]);
                  setCursor(nextCursor);
                }}
                disabled={!pagination?.next_cursor || !pagination?.has_more}
              >
                Next cursor
              </Button>
            </div>
          </div>

          <div className="surface-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="font-mono-data text-muted-foreground">Loading audit history...</TableCell>
                  </TableRow>
                )}
                {historyQuery.isError && (
                  <TableRow>
                    <TableCell colSpan={8} className="font-mono-data text-destructive">Failed to fetch audit history.</TableCell>
                  </TableRow>
                )}
                {!historyQuery.isLoading && !historyQuery.isError && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">No audit events found for current filters.</TableCell>
                  </TableRow>
                )}
                {items.map((event: AuditEvent) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono-data text-xs">{new Date((event.timestamp || 0) * 1000).toLocaleString()}</TableCell>
                    <TableCell className="font-mono-data text-xs">{event.actor?.display_name || event.actor?.id || "-"}</TableCell>
                    <TableCell className="font-mono-data text-xs">{event.action || event.event_type || "-"}</TableCell>
                    <TableCell className="font-mono-data text-xs">{event.target?.display_name || event.target?.id || "-"}</TableCell>
                    <TableCell className="font-mono-data text-xs">{event.method ? `${event.method} ` : ""}{event.endpoint || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={eventStatusVariant(event.status)}>{event.status || "unknown"}</Badge>
                        {event.severity && <Badge variant={severityVariant(event.severity)}>{event.severity}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono-data text-xs">{event.request_id || "-"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setDetailOpen(true);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <div className="surface-card p-5 space-y-4">
            <p className="text-sm text-muted-foreground">Export uses async jobs. Poll status until ready, then download CSV.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="actor">Actor ID</Label>
                <Input id="actor" value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="admin_001" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target">Target ID</Label>
                <Input id="target" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="cleaner_123" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="endpoint">Endpoint</Label>
                <Input id="endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="/v1/admins/monitoring/alerts" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => exportCreateMutation.mutate()} disabled={exportCreateMutation.isPending}>
                {exportCreateMutation.isPending ? "Creating export job..." : "Create Export Job"}
              </Button>
              <Button
                variant="outline"
                onClick={() => exportStatusQuery.refetch()}
                disabled={!activeJob?.export_id || exportStatusQuery.isFetching}
              >
                {exportStatusQuery.isFetching ? "Refreshing..." : "Refresh Status"}
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadMutation.mutate()}
                disabled={!activeJob?.export_id || activeJob.status !== "ready" || downloadMutation.isPending}
              >
                {downloadMutation.isPending ? "Downloading..." : "Download CSV"}
              </Button>
            </div>

            {exportCreateMutation.isError && <p className="text-sm text-destructive">Failed to create export job.</p>}
            {downloadMutation.isError && (
              <p className="text-sm text-destructive">{(downloadMutation.error as Error)?.message || "Download failed."}</p>
            )}

            {activeJob && (
              <div className="rounded-md border border-border p-3 text-sm space-y-1">
                <div>Export ID: <span className="font-mono-data">{activeJob.export_id}</span></div>
                <div className="flex items-center gap-2">
                  <span>Status:</span>
                  <Badge variant={activeJob.status === "ready" ? "success" : activeJob.status === "failed" ? "destructive" : "secondary"}>{activeJob.status}</Badge>
                </div>
                <div>Estimated rows: <span className="font-mono-data">{activeJob.estimated_rows ?? "-"}</span></div>
                <div>Expires: <span className="font-mono-data">{activeJob.expires_at ? String(activeJob.expires_at) : "-"}</span></div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Audit Event Detail</SheetTitle>
            <SheetDescription>Fetches event data from audit history detail endpoint.</SheetDescription>
          </SheetHeader>

          <div className="mt-3 space-y-2">
            <Label htmlFor="redaction">Redaction</Label>
            <Input id="redaction" value={detailRedaction} onChange={(e) => setDetailRedaction((e.target.value as "strict" | "standard" | "none") || "strict")} />
          </div>

          {eventDetailQuery.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading event detail...</p>}
          {eventDetailQuery.isError && <p className="mt-4 text-sm text-destructive">Failed to fetch event detail.</p>}
          {!!eventDetailQuery.data && (
            <pre className="mt-4 rounded-md bg-muted p-3 text-xs overflow-auto max-h-[70vh]">
              {JSON.stringify(eventDetailQuery.data, null, 2)}
            </pre>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
