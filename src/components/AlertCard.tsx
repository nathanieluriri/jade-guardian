import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Eye } from "lucide-react";
import { useState } from "react";

interface Alert {
  _id: string;
  rule_key: string;
  severity: "info" | "warning" | "high" | "critical";
  title: string;
  summary: string;
  status: string;
  is_read: boolean;
  ack_owner_id: string | null;
  last_fired_at: number;
  date_created: number;
}

function timeAgo(epoch: number): string {
  const diff = Math.floor(Date.now() / 1000 - epoch);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const severityMap: Record<string, "critical" | "high" | "warning" | "info"> = {
  critical: "critical",
  high: "high",
  warning: "warning",
  info: "info",
};

export function AlertCard({ alert, index }: { alert: Alert; index: number }) {
  const [acked, setAcked] = useState(!!alert.ack_owner_id);
  const [read, setRead] = useState(alert.is_read);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: read ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: [0.2, 0, 0, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="surface-card surface-card-hover p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono-data text-muted-foreground uppercase tracking-widest">
          {alert.rule_key}
        </span>
        <Badge variant={severityMap[alert.severity] || "secondary"}>
          {alert.severity}
        </Badge>
      </div>
      <h3 className="text-[15px] font-semibold text-foreground leading-tight text-balance">
        {alert.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{alert.summary}</p>
      <div className="mt-1 font-mono-data text-muted-foreground">
        Fired {timeAgo(alert.last_fired_at)}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            size="sm"
            variant={acked ? "default" : "outline"}
            onClick={() => setAcked(!acked)}
          >
            <Check className="h-3.5 w-3.5" />
            {acked ? "Acknowledged" : "Acknowledge"}
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button size="sm" variant="ghost" onClick={() => setRead(!read)}>
            <Eye className="h-3.5 w-3.5" />
            {read ? "Unread" : "Mark Read"}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
