import { mockSessionAnomalies } from "@/lib/mock-data";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
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
  const data = mockSessionAnomalies;
  const entries = Object.entries(data.active_sessions_by_admin).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6 max-w-[1000px]">
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-semibold tracking-tighter"
      >
        Session Risk Panel
      </motion.h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Global Active Sessions" value={data.global_active_sessions} />
        <MetricCard label="Long-Lived Sessions" value={data.long_lived_session_count} variant={data.long_lived_session_count > 0 ? "danger" : "default"} />
        <MetricCard
          label="Session Spike"
          value={data.recent_session_spike_detected ? "Detected" : "None"}
          variant={data.recent_session_spike_detected ? "danger" : "success"}
        />
      </div>

      {/* Sessions by admin */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="surface-card"
      >
        <div className="p-4 border-b border-border">
          <h3 className="text-label text-muted-foreground">Active Sessions by Admin</h3>
        </div>
        <motion.div variants={stagger} initial="hidden" animate="visible" className="divide-y divide-border">
          {entries.map(([adminId, count]) => (
            <motion.div
              key={adminId}
              variants={fadeUp}
              className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors duration-150"
            >
              <span className="font-mono-data text-foreground">{adminId}</span>
              <Badge variant={count > 3 ? "high" : "info"}>{count} sessions</Badge>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Revoke actions */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Revoke Current Session", desc: "This will terminate your current session. You will be logged out immediately.", btn: "Revoke", variant: "outline" as const },
          { label: "Revoke Other Sessions", desc: "All sessions except your current one will be terminated.", btn: "Revoke Others", variant: "outline" as const },
          { label: "Revoke All Sessions", desc: "This is a destructive action. ALL admin sessions will be terminated including yours.", btn: "Revoke All", variant: "destructive" as const },
        ].map((action) => (
          <AlertDialog key={action.label}>
            <AlertDialogTrigger asChild>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Button variant={action.variant} size="sm">{action.label}</Button>
              </motion.div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{action.label}</AlertDialogTitle>
                <AlertDialogDescription>{action.desc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {action.btn}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </div>
    </div>
  );
}
