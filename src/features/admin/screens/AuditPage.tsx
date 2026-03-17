"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { exportAuditLog, fetchAlerts, fetchDeniedPermissions, fetchSessionAnomalies } from "@/lib/api/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type AuditPreset = "all" | "suspicious-login" | "permission-denials" | "onboarding-decisions";

type AuditEvent = {
  id: string;
  time: number;
  actor: string;
  action: string;
  target: string;
  endpoint: string;
  status: string;
  requestId?: string;
  details: Record<string, unknown>;
};

export default function AuditPage() {
  const searchParams = useSearchParams();
  const [preset, setPreset] = useState<AuditPreset>("all");
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [startEpoch, setStartEpoch] = useState("");
  const [endEpoch, setEndEpoch] = useState("");

  useEffect(() => {
    const presetParam = searchParams.get("preset");
    const endpointParam = searchParams.get("endpoint");
    const targetParam = searchParams.get("target");

    if (presetParam && ["all", "suspicious-login", "permission-denials", "onboarding-decisions"].includes(presetParam)) {
      setPreset(presetParam as AuditPreset);
    }
    if (endpointParam) setEndpoint(endpointParam);
    if (targetParam) setTargetId(targetParam);
  }, [searchParams]);

  const alertsQuery = useQuery({ queryKey: ["audit-history", "alerts"], queryFn: () => fetchAlerts({ start: 0, stop: 50 }) });
  const deniedQuery = useQuery({ queryKey: ["audit-history", "denied"], queryFn: () => fetchDeniedPermissions(24, 30) });
  const sessionsQuery = useQuery({ queryKey: ["audit-history", "sessions"], queryFn: fetchSessionAnomalies });

  const events = useMemo<AuditEvent[]>(() => {
    const fromAlerts: AuditEvent[] = (alertsQuery.data || []).map((alert) => ({
      id: `alert-${alert._id}`,
      time: alert.last_fired_at,
      actor: alert.affected_user || "unknown",
      action: alert.rule_key,
      target: alert.source_ip || "system",
      endpoint: "/v1/admins/monitoring/alerts",
      status: alert.status,
      requestId: undefined,
      details: {
        severity: alert.severity,
        summary: alert.summary,
      },
    }));

    const fromDenied: AuditEvent[] = (deniedQuery.data || []).map((item, index) => ({
      id: `deny-${index}`,
      time: Math.floor(Date.now() / 1000),
      actor: item.admins.join(", ") || "unknown",
      action: "permission_denied",
      target: item.permission_key,
      endpoint: "/v1/admins/monitoring/permissions/denied-top",
      status: "denied",
      details: {
        deny_count: item.deny_count,
      },
    }));

    const fromSessions: AuditEvent[] = sessionsQuery.data
      ? Object.entries(sessionsQuery.data.active_sessions_by_admin).map(([adminId, count]) => ({
          id: `session-${adminId}`,
          time: Math.floor(Date.now() / 1000),
          actor: adminId,
          action: "session_anomaly",
          target: `${count} active sessions`,
          endpoint: "/v1/admins/monitoring/sessions/anomalies",
          status: count > 3 ? "high-risk" : "normal",
          details: {
            active_sessions: count,
          },
        }))
      : [];

    const merged = [...fromAlerts, ...fromDenied, ...fromSessions].sort((a, b) => b.time - a.time);
    if (preset === "suspicious-login") return merged.filter((item) => item.action.includes("login") || item.action.includes("suspicious"));
    if (preset === "permission-denials") return merged.filter((item) => item.action.includes("permission") || item.status === "denied");
    if (preset === "onboarding-decisions") return merged.filter((item) => item.action.includes("onboarding") || item.target.includes("cleaner"));
    return merged;
  }, [alertsQuery.data, deniedQuery.data, sessionsQuery.data, preset]);

  const exportMutation = useMutation({
    mutationFn: () =>
      exportAuditLog({
        actor_id: actorId || null,
        target_id: targetId || null,
        endpoint: endpoint || null,
        start_epoch: startEpoch ? Number(startEpoch) : null,
        end_epoch: endEpoch ? Number(endEpoch) : null,
        limit: 500,
      }),
  });

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
                onClick={() => setPreset(option.key as AuditPreset)}
              >
                {option.label}
              </Button>
            ))}
            <Badge variant="secondary">Total: {events.length}</Badge>
            {(endpoint || targetId || actorId) && (
              <Badge variant="outline" className="font-mono-data">
                Query: {actorId || "*"} / {targetId || "*"} / {endpoint || "*"}
              </Badge>
            )}
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
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono-data text-xs">{new Date(event.time * 1000).toLocaleString()}</TableCell>
                    <TableCell className="font-mono-data text-xs">{event.actor}</TableCell>
                    <TableCell className="font-mono-data text-xs">{event.action}</TableCell>
                    <TableCell className="font-mono-data text-xs">{event.target}</TableCell>
                    <TableCell className="font-mono-data text-xs">{event.endpoint}</TableCell>
                    <TableCell>
                      <Badge variant={event.status === "denied" || event.status === "high-risk" ? "warning" : "secondary"}>{event.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono-data text-xs">{event.requestId || "-"}</TableCell>
                    <TableCell>
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button size="sm" variant="outline">View</Button>
                        </SheetTrigger>
                        <SheetContent className="sm:max-w-lg">
                          <SheetHeader>
                            <SheetTitle>{event.action}</SheetTitle>
                            <SheetDescription>Redacted payload details</SheetDescription>
                          </SheetHeader>
                          <pre className="mt-4 rounded-md bg-muted p-3 text-xs overflow-auto">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        </SheetContent>
                      </Sheet>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <div className="surface-card p-5 space-y-4">
            <p className="text-sm text-muted-foreground">Export can be prefilled from your active history filters.</p>

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
                <Input id="endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="/v1/admins/monitoring/overview" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start">Start Epoch</Label>
                <Input id="start" value={startEpoch} onChange={(e) => setStartEpoch(e.target.value)} placeholder="1710000000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">End Epoch</Label>
                <Input id="end" value={endEpoch} onChange={(e) => setEndEpoch(e.target.value)} placeholder="1710086400" />
              </div>
            </div>

            {exportMutation.isError && <p className="text-sm text-destructive">Failed to generate export request.</p>}
            {exportMutation.isSuccess && <p className="text-sm text-primary">Audit export request submitted successfully.</p>}

            <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? "Generating..." : "Generate Audit Export"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
