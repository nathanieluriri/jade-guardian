"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Eye, Search, Globe } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
  source_ip?: string;
  affected_user?: string;
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

const severityBorderColor: Record<string, string> = {
  critical: "border-l-destructive",
  high: "border-l-warning",
  warning: "border-l-anomaly",
  info: "border-l-info",
};

interface AlertCardProps {
  alert: Alert;
  index: number;
  onAcknowledge?: (alertId: string, nextAck: boolean) => void;
  onReadToggle?: (alertId: string, nextRead: boolean) => void;
  onInvestigate?: (alertId: string) => void;
}

export function AlertCard({ alert, index, onAcknowledge, onReadToggle, onInvestigate }: AlertCardProps) {
  const router = useRouter();
  const [acked, setAcked] = useState(!!alert.ack_owner_id);
  const [read, setRead] = useState(alert.is_read);

  const handleAcknowledge = () => {
    const next = !acked;
    setAcked(next);
    onAcknowledge?.(alert._id, next);
  };

  const handleReadToggle = () => {
    const next = !read;
    setRead(next);
    onReadToggle?.(alert._id, next);
  };

  const handleInvestigate = () => {
    onInvestigate?.(alert._id);
    router.push(
      `/admin/security/audit?preset=suspicious-login&endpoint=${encodeURIComponent("/v1/admins/monitoring/alerts")}&target=${encodeURIComponent(alert._id)}`
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: read ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: [0.2, 0, 0, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        "surface-card surface-card-hover p-4 border-l-[3px] group",
        severityBorderColor[alert.severity] || "border-l-border"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono-data text-muted-foreground uppercase tracking-widest">{alert.rule_key}</span>
        <Badge variant={severityMap[alert.severity] || "secondary"}>{alert.severity}</Badge>
      </div>
      <h3 className="text-[15px] font-semibold text-foreground leading-tight text-balance">{alert.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{alert.summary}</p>

      {(alert.source_ip || alert.affected_user) && (
        <div className="mt-1.5 flex items-center gap-3 font-mono-data text-muted-foreground">
          {alert.source_ip && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {alert.source_ip}
            </span>
          )}
          {alert.affected_user && <span>User: {alert.affected_user}</span>}
        </div>
      )}

      <div className="mt-1 font-mono-data text-muted-foreground">Fired {timeAgo(alert.last_fired_at)}</div>

      <div className="mt-3 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button size="sm" variant={acked ? "default" : "outline"} onClick={handleAcknowledge}>
            <Check className="h-3.5 w-3.5" />
            {acked ? "Acknowledged" : "Acknowledge"}
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button size="sm" variant="outline" onClick={handleInvestigate}>
            <Search className="h-3.5 w-3.5" />
            Investigate
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button size="sm" variant="ghost" onClick={handleReadToggle}>
            <Eye className="h-3.5 w-3.5" />
            {read ? "Unread" : "Dismiss"}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
