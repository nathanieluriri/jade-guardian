import { useState } from "react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HeatmapItem {
  day_of_week: number;
  hour_of_day: number;
  success_count?: number;
  failure_count?: number;
  value?: number;
}

interface AuthHeatmapProps {
  items: HeatmapItem[];
  latencyItems?: { day_of_week: number; hour_of_day: number; value: number }[];
  trafficItems?: { day_of_week: number; hour_of_day: number; value: number }[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TABS = ["Auth Failures", "Latency", "Traffic"] as const;
type TabType = (typeof TABS)[number];

// 5-step color gradient
function getHeatColor(value: number, max: number): string {
  if (max === 0) return "hsl(var(--muted))";
  const ratio = value / max;
  if (ratio < 0.1) return "hsl(var(--muted))";
  if (ratio < 0.3) return "hsl(48, 96%, 89%)";   // light yellow
  if (ratio < 0.5) return "hsl(38, 92%, 70%)";    // orange
  if (ratio < 0.75) return "hsl(0, 72%, 65%)";    // red
  return "hsl(0, 84%, 50%)";                       // deep crimson
}

function getLatencyColor(value: number, max: number): string {
  if (max === 0) return "hsl(var(--muted))";
  const ratio = value / max;
  if (ratio < 0.2) return "hsl(var(--muted))";
  if (ratio < 0.4) return "hsl(142, 60%, 80%)";
  if (ratio < 0.6) return "hsl(48, 96%, 70%)";
  if (ratio < 0.8) return "hsl(25, 90%, 60%)";
  return "hsl(0, 72%, 55%)";
}

function getTrafficColor(value: number, max: number): string {
  if (max === 0) return "hsl(var(--muted))";
  const ratio = value / max;
  if (ratio < 0.2) return "hsl(var(--emerald-50))";
  if (ratio < 0.4) return "hsl(var(--emerald-200))";
  if (ratio < 0.6) return "hsl(var(--emerald-300))";
  if (ratio < 0.8) return "hsl(var(--emerald-400))";
  return "hsl(var(--emerald-600))";
}

const cellVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.003, duration: 0.2, ease: [0.2, 0, 0, 1] as const },
  }),
};

export function AuthHeatmap({ items, latencyItems, trafficItems }: AuthHeatmapProps) {
  const [activeTab, setActiveTab] = useState<TabType>("Auth Failures");

  const maxFailure = Math.max(...items.map((i) => i.failure_count ?? 0), 1);
  const maxLatency = latencyItems ? Math.max(...latencyItems.map((i) => i.value), 1) : 1;
  const maxTraffic = trafficItems ? Math.max(...trafficItems.map((i) => i.value), 1) : 1;

  const getItem = (day: number, hour: number) =>
    items.find((i) => i.day_of_week === day && i.hour_of_day === hour);
  const getLatencyItem = (day: number, hour: number) =>
    latencyItems?.find((i) => i.day_of_week === day && i.hour_of_day === hour);
  const getTrafficItem = (day: number, hour: number) =>
    trafficItems?.find((i) => i.day_of_week === day && i.hour_of_day === hour);

  function getCellData(day: number, hour: number) {
    if (activeTab === "Auth Failures") {
      const item = getItem(day, hour);
      const failures = item?.failure_count ?? 0;
      const successes = item?.success_count ?? 0;
      return {
        color: getHeatColor(failures, maxFailure),
        tooltip: `${successes} ok, ${failures} fail`,
        value: failures,
      };
    } else if (activeTab === "Latency") {
      const item = getLatencyItem(day, hour);
      const val = item?.value ?? 0;
      return {
        color: getLatencyColor(val, maxLatency),
        tooltip: `${val}ms avg`,
        value: val,
      };
    } else {
      const item = getTrafficItem(day, hour);
      const val = item?.value ?? 0;
      return {
        color: getTrafficColor(val, maxTraffic),
        tooltip: `${val} requests`,
        value: val,
      };
    }
  }

  let cellIndex = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1, ease: [0.2, 0, 0, 1] }}
      className="surface-card p-4"
    >
      {/* Tab bar */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-label text-muted-foreground">Heatmap — Last 7 Days</h3>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: `40px repeat(24, 1fr)` }}>
          {/* Hour headers */}
          <div />
          {HOURS.map((h) => (
            <div key={h} className="font-mono-data text-muted-foreground text-center w-5">
              {h % 6 === 0 ? h : ""}
            </div>
          ))}

          {/* Grid */}
          {DAYS.map((day, dayIdx) => (
            <div key={`day-row-${dayIdx}`} className="contents">
              <div key={`label-${dayIdx}`} className="font-mono-data text-muted-foreground flex items-center pr-1">
                {day}
              </div>
              {HOURS.map((hour) => {
                const cell = getCellData(dayIdx, hour);
                const idx = cellIndex++;
                return (
                  <Tooltip key={`${dayIdx}-${hour}`}>
                    <TooltipTrigger asChild>
                      <motion.div
                        custom={idx}
                        variants={cellVariants}
                        initial="hidden"
                        animate="visible"
                        className="w-5 h-5 rounded-sm cursor-default"
                        style={{ backgroundColor: cell.color }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-mono-data">
                      {day} {hour}:00 — {cell.tooltip}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Color legend */}
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Low</span>
        <div className="flex gap-0.5">
          {["hsl(var(--muted))", "hsl(48, 96%, 89%)", "hsl(38, 92%, 70%)", "hsl(0, 72%, 65%)", "hsl(0, 84%, 50%)"].map(
            (c, i) => (
              <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
            )
          )}
        </div>
        <span>High</span>
      </div>
    </motion.div>
  );
}
