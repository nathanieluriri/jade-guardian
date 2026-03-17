"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCard } from "@/components/AlertCard";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { fetchAlerts, updateAlertAckState, updateAlertReadState } from "@/lib/api/admin-api";

type StatusFilter = "all" | "open" | "acknowledged";

export default function AlertsPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ["alerts", filter, unreadOnly],
    queryFn: () =>
      fetchAlerts({
        status: filter === "all" ? undefined : filter,
        unreadOnly,
        start: 0,
        stop: 50,
      }),
  });

  const markReadMutation = useMutation({
    mutationFn: ({ alertId, isRead }: { alertId: string; isRead: boolean }) => updateAlertReadState(alertId, isRead),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const ackMutation = useMutation({
    mutationFn: ({ alertId, ack }: { alertId: string; ack: boolean }) => updateAlertAckState(alertId, ack),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const alerts = alertsQuery.data || [];

  return (
    <div className="space-y-5 max-w-[1000px]">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tighter">
        Alert Center
      </motion.h1>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "open", "acknowledged"] as StatusFilter[]).map((s) => (
          <motion.div key={s} whileTap={{ scale: 0.97 }}>
            <Button size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize">
              {s}
            </Button>
          </motion.div>
        ))}
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button size="sm" variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly(!unreadOnly)}>
            Unread Only
          </Button>
        </motion.div>
      </div>

      <div className="grid gap-3">
        {alertsQuery.isLoading && <p className="font-mono-data text-muted-foreground">Loading alerts...</p>}
        {alertsQuery.isError && <p className="font-mono-data text-destructive">Failed to fetch alerts.</p>}
        <AnimatePresence mode="popLayout">
          {!alertsQuery.isLoading && alerts.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="surface-card p-8 text-center"
            >
              <p className="text-label text-muted-foreground">No alerts match current filters.</p>
            </motion.div>
          )}
          {alerts.map((alert, i) => (
            <AlertCard
              key={alert._id}
              alert={alert}
              index={i}
              onAcknowledge={(alertId, ack) => ackMutation.mutate({ alertId, ack })}
              onReadToggle={(alertId, isRead) => markReadMutation.mutate({ alertId, isRead })}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
