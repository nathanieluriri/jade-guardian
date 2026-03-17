"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Dot, Loader2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { MonitoringAlert } from "@/lib/api/types";

function formatRelativeTime(epochSeconds: number) {
  const delta = Math.round((epochSeconds * 1000 - Date.now()) / 1000);
  const abs = Math.abs(delta);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) return rtf.format(Math.round(delta), "second");
  if (abs < 3600) return rtf.format(Math.round(delta / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(delta / 3600), "hour");
  return rtf.format(Math.round(delta / 86400), "day");
}

function severityBadgeVariant(severity: MonitoringAlert["severity"]) {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "warning") return "warning";
  return "info";
}

interface AlertCardProps {
  alert: MonitoringAlert;
  index?: number;
  selected?: boolean;
  suppressRowActions?: boolean;
  showSelectionControl?: boolean;
  readActionPending?: boolean;
  ackActionPending?: boolean;
  onSelectToggle?: (alertId: string, selected: boolean) => void;
  onAcknowledge?: (alertId: string, ack: boolean) => void;
  onReadToggle?: (alertId: string, isRead: boolean) => void;
  onInvestigate?: (alertId: string) => void;
}

export const AlertCard = memo(function AlertCard({
  alert,
  index = 0,
  selected = false,
  suppressRowActions = false,
  showSelectionControl = false,
  readActionPending = false,
  ackActionPending = false,
  onSelectToggle,
  onAcknowledge,
  onReadToggle,
  onInvestigate,
}: AlertCardProps) {
  const isUnread = !alert.is_read;
  const isAcked = !!alert.ack_owner_id;
  const hasRowActions = !!onAcknowledge || !!onReadToggle || !!onInvestigate;
  const relativeLastFired = formatRelativeTime(alert.last_fired_at);
  const exactLastFired = new Date(alert.last_fired_at * 1000).toISOString();

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.2 }}
      className={[
        "rounded-xl border p-4 sm:p-5 transition-colors",
        selected ? "border-primary bg-primary/10" : "border-border",
        isUnread ? "bg-sky-50/70" : "bg-card",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        {showSelectionControl && (
          <div className="pt-1">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectToggle?.(alert._id, !!checked)}
              aria-label={`Select alert ${alert.title}`}
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                {isUnread ? <Dot className="h-5 w-5 text-sky-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                <h3 className={["truncate text-sm sm:text-base", isUnread ? "font-semibold" : "font-medium"].join(" ")}>
                  {alert.title}
                </h3>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">{alert.summary}</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={severityBadgeVariant(alert.severity)} className="uppercase tracking-[0.08em]">
                {alert.severity}
              </Badge>
              <Badge variant="secondary">{isAcked ? "Acknowledged" : "Unacknowledged"}</Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono-data">{alert.rule_key}</span>
            <span title={exactLastFired}>Last fired {relativeLastFired}</span>
            {alert.source_ip && <span>IP: {alert.source_ip}</span>}
            {alert.affected_user && <span>User: {alert.affected_user}</span>}
          </div>

          {!suppressRowActions && hasRowActions && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReadToggle?.(alert._id, isUnread)}
                disabled={readActionPending}
              >
                {readActionPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  isUnread ? "Mark Read" : "Mark Unread"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAcknowledge?.(alert._id, !isAcked)}
                disabled={ackActionPending}
              >
                {ackActionPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  isAcked ? "Unacknowledge" : "Acknowledge"
                )}
              </Button>
              {onInvestigate && (
                <Button size="sm" onClick={() => onInvestigate(alert._id)} className="gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Investigate
                </Button>
              )}
              {isAcked && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Ack owner set
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
});
