"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  revokeAllSessions,
  revokeCurrentSession,
  revokeOtherSessions,
  fetchSessionAnomalies,
} from "@/lib/api/admin-api";
import { clearAuthState } from "@/lib/api/auth-storage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

export default function SessionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  const sessionsQuery = useQuery({ queryKey: ["session-anomalies"], queryFn: fetchSessionAnomalies });

  const revokeCurrentMutation = useMutation({
    mutationFn: revokeCurrentSession,
    onSuccess: () => {
      toast.success("Current session revoked. Logging out...");
      clearAuthState();
      queryClient.clear();
      router.replace("/admin/login");
    },
    onError: () => toast.error("Failed to revoke current session."),
  });
  const revokeOthersMutation = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => {
      toast.success("Other sessions revoked.");
      queryClient.invalidateQueries({ queryKey: ["session-anomalies"] });
    },
    onError: () => toast.error("Failed to revoke other sessions."),
  });
  const revokeAllMutation = useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: () => {
      setConfirmText("");
      toast.success("All sessions revoked.");
      queryClient.invalidateQueries({ queryKey: ["session-anomalies"] });
    },
    onError: () => toast.error("Failed to revoke all sessions."),
  });

  const sortedEntries = useMemo(() => {
    if (!sessionsQuery.data) return [] as Array<[string, number]>;
    return Object.entries(sessionsQuery.data.active_sessions_by_admin).sort((a, b) => b[1] - a[1]);
  }, [sessionsQuery.data]);

  if (sessionsQuery.isLoading) {
    return <p className="font-mono-data text-muted-foreground">Loading session anomalies...</p>;
  }

  if (sessionsQuery.isError || !sessionsQuery.data) {
    return <p className="font-mono-data text-destructive">Failed to load session anomaly metrics.</p>;
  }

  const data = sessionsQuery.data;

  return (
    <div className="space-y-6 max-w-[1000px]">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tighter">
        Session Risk Panel
      </motion.h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Global Active Sessions" value={data.global_active_sessions} />
        <MetricCard
          label="Long-Lived Sessions"
          value={data.long_lived_session_count}
          variant={data.long_lived_session_count > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Session Spike"
          value={data.recent_session_spike_detected ? "Detected" : "None"}
          variant={data.recent_session_spike_detected ? "danger" : "success"}
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="surface-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-label text-muted-foreground">Active Sessions by Admin</h3>
          <span className="text-xs text-muted-foreground">Higher counts can indicate session sharing or token abuse.</span>
        </div>
        <motion.div variants={stagger} initial="hidden" animate="visible" className="divide-y divide-border">
          {sortedEntries.map(([adminId, count]) => (
            <motion.div key={adminId} variants={fadeUp} className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors duration-150">
              <div className="space-y-1">
                <span className="font-mono-data text-foreground">{adminId}</span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CircleAlert className="h-3.5 w-3.5" />
                  Risk score inferred from active session volume only.
                </div>
              </div>
              <Badge variant={count > 3 ? "high" : "info"}>{count} sessions</Badge>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">Revoke Current Session</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke Current Session</AlertDialogTitle>
              <AlertDialogDescription>
                This terminates your current session and logs you out immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => revokeCurrentMutation.mutate()}>
                Revoke
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">Revoke Other Sessions</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke Other Sessions</AlertDialogTitle>
              <AlertDialogDescription>
                Terminates all sessions except your current one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => revokeOthersMutation.mutate()}>
                Revoke Others
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">Revoke All Sessions</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke All Sessions</AlertDialogTitle>
              <AlertDialogDescription>
                Type <span className="font-mono-data">REVOKE ALL</span> to confirm global revocation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="revoke-all-confirm">Confirmation Text</Label>
              <Input id="revoke-all-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={confirmText !== "REVOKE ALL" || revokeAllMutation.isPending}
                onClick={() => revokeAllMutation.mutate()}
              >
                {revokeAllMutation.isPending ? "Revoking..." : "Revoke All"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
