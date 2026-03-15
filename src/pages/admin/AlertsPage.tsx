import { AlertCard } from "@/components/AlertCard";
import { mockAlerts } from "@/lib/mock-data";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

type StatusFilter = "all" | "open" | "acknowledged";

export default function AlertsPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = mockAlerts.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (unreadOnly && a.is_read) return false;
    return true;
  });

  return (
    <div className="space-y-5 max-w-[1000px]">
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-semibold tracking-tighter"
      >
        Alert Center
      </motion.h1>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "open", "acknowledged"] as StatusFilter[]).map((s) => (
          <motion.div key={s} whileTap={{ scale: 0.97 }}>
            <Button
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          </motion.div>
        ))}
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            size="sm"
            variant={unreadOnly ? "default" : "outline"}
            onClick={() => setUnreadOnly(!unreadOnly)}
          >
            Unread Only
          </Button>
        </motion.div>
      </div>

      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 && (
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
          {filtered.map((alert, i) => (
            <AlertCard key={alert._id} alert={alert} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
