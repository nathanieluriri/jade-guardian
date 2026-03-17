"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { exportAuditLog } from "@/lib/api/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuditPage() {
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [startEpoch, setStartEpoch] = useState("");
  const [endEpoch, setEndEpoch] = useState("");

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
    <div className="space-y-5 max-w-[900px]">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tighter">
        Audit Log Export
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="surface-card p-5 space-y-4"
      >
        <p className="text-sm text-muted-foreground">
          The current API exposes audit export generation. Configure optional filters and trigger export.
        </p>

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
      </motion.div>
    </div>
  );
}
