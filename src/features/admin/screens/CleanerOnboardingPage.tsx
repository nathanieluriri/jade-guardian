"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { reviewCleanerOnboarding } from "@/lib/api/admin-api";
import type { ApiError } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface DecisionLog {
  cleanerId: string;
  status: "APPROVED" | "REJECTED";
  timestamp: string;
}

export default function CleanerOnboardingPage() {
  const [cleanerId, setCleanerId] = useState("");
  const [status, setStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [decisionLog, setDecisionLog] = useState<DecisionLog[]>([]);

  const reviewMutation = useMutation({
    mutationFn: ({ selectedStatus, reason }: { selectedStatus: "APPROVED" | "REJECTED"; reason?: string }) =>
      reviewCleanerOnboarding(cleanerId.trim(), selectedStatus, reason),
    onSuccess: (_, variables) => {
      const normalizedCleanerId = cleanerId.trim();
      setDecisionLog((prev) => [
        {
          cleanerId: normalizedCleanerId,
          status: variables.selectedStatus,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success(`Cleaner ${normalizedCleanerId} ${variables.selectedStatus.toLowerCase()}.`);
      if (variables.selectedStatus === "REJECTED") {
        setRejectionReason("");
      }
    },
    onError: (error) => {
      const apiError = error as unknown as ApiError;
      const requestIdLine = apiError.requestId ? ` Request ID: ${apiError.requestId}` : "";
      toast.error(`${apiError.message || "Review request failed."}${requestIdLine}`);
    },
  });

  const canSubmit =
    !!cleanerId.trim() && (status === "APPROVED" || (status === "REJECTED" && rejectionReason.trim().length > 0));

  return (
    <div className="max-w-[1100px] space-y-5">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tighter mb-5">
        Cleaner Onboarding
      </motion.h1>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          No dedicated admin onboarding-queue listing endpoint exists yet. Submit decisions using the backend cleaner document ID (`id` or fallback `_id`) from existing cleaner/booking payloads.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cleaner-id">Cleaner ID</Label>
            <Input
              id="cleaner-id"
              value={cleanerId}
              onChange={(event) => setCleanerId(event.target.value)}
              placeholder="67f2d5804f0fce2a130fe832"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Decision</Label>
            <div className="flex gap-2">
              <Button type="button" variant={status === "APPROVED" ? "default" : "outline"} onClick={() => setStatus("APPROVED")}>
                APPROVED
              </Button>
              <Button type="button" variant={status === "REJECTED" ? "default" : "outline"} onClick={() => setStatus("REJECTED")}>
                REJECTED
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rejection-reason">Rejection Reason (required when rejected)</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Missing government ID image and incomplete payout information."
              disabled={status !== "REJECTED"}
            />
          </div>
        </div>

        <Button
          onClick={() =>
            reviewMutation.mutate({
              selectedStatus: status,
              reason: status === "REJECTED" ? rejectionReason.trim() : undefined,
            })
          }
          disabled={!canSubmit || reviewMutation.isPending}
        >
          {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card p-5">
        <h2 className="text-label text-muted-foreground mb-3">Recent Decisions (Current Session)</h2>
        {decisionLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {decisionLog.map((item) => (
              <div key={`${item.cleanerId}-${item.timestamp}`} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                <p className="font-mono-data text-sm">{item.cleanerId}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === "APPROVED" ? "success" : "destructive"}>{item.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
