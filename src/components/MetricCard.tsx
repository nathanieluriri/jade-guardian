import { motion } from "framer-motion";
import { ReactNode } from "react";
import { HelpCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: number | string;
  variant?: "default" | "danger" | "success";
  suffix?: ReactNode;
  tooltip?: string;
  sparkline?: number[];
  trend?: { value: number; direction: "up" | "down" };
  anomaly?: boolean;
}

function Sparkline({ data, variant = "default" }: { data: number[]; variant?: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const h = 28;
  const w = 80;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");

  const strokeColor =
    variant === "danger"
      ? "hsl(var(--destructive))"
      : variant === "success"
      ? "hsl(var(--primary))"
      : "hsl(var(--muted-foreground))";

  return (
    <svg width={w} height={h} className="shrink-0 opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  variant = "default",
  suffix,
  tooltip,
  sparkline,
  trend,
  anomaly,
}: MetricCardProps) {
  const valueColor =
    variant === "danger"
      ? "text-destructive"
      : variant === "success"
      ? "text-primary"
      : "text-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        "surface-card surface-card-hover p-4",
        anomaly && "animate-border-pulse"
      )}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="text-label text-muted-foreground">{label}</p>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors shrink-0" />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-[260px] text-xs leading-relaxed bg-foreground text-background border-0 px-3 py-2"
            >
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold tracking-tighter tabular-nums ${valueColor}`}>
              {value}
            </span>
            {suffix}
          </div>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 mt-1 text-[11px] font-medium",
                trend.direction === "up" ? "text-destructive" : "text-primary"
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {trend.direction === "up" ? "↑" : "↓"} {trend.value}% vs last week
              </span>
            </div>
          )}
        </div>
        {sparkline && <Sparkline data={sparkline} variant={variant} />}
      </div>
    </motion.div>
  );
}
