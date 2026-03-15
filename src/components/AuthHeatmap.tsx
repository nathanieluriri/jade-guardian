import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeatmapItem {
  day_of_week: number;
  hour_of_day: number;
  success_count: number;
  failure_count: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getOpacity(count: number, max: number): number {
  if (max === 0) return 0.05;
  return Math.max(0.05, count / max);
}

const cellVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.003, duration: 0.2, ease: [0.2, 0, 0, 1] as const },
  }),
};

export function AuthHeatmap({ items }: { items: HeatmapItem[] }) {
  const maxFailure = Math.max(...items.map((i) => i.failure_count), 1);

  const getItem = (day: number, hour: number) =>
    items.find((i) => i.day_of_week === day && i.hour_of_day === hour);

  let cellIndex = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1, ease: [0.2, 0, 0, 1] }}
      className="surface-card p-4"
    >
      <h3 className="text-label text-muted-foreground mb-3">Auth Failure Heatmap — Last 7 Days</h3>
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
            <>
              <div key={`label-${dayIdx}`} className="font-mono-data text-muted-foreground flex items-center pr-1">
                {day}
              </div>
              {HOURS.map((hour) => {
                const item = getItem(dayIdx, hour);
                const failures = item?.failure_count ?? 0;
                const successes = item?.success_count ?? 0;
                const opacity = getOpacity(failures, maxFailure);
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
                        style={{
                          backgroundColor:
                            failures > maxFailure * 0.6
                              ? `hsla(0, 84%, 60%, ${opacity})`
                              : `hsla(142, 71%, 45%, ${opacity})`,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-mono-data">
                      {day} {hour}:00 — {successes} ok, {failures} fail
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
