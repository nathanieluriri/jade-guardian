import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Deterministic widths — random ones would differ between server and client. */
const CELL_WIDTHS = ["w-32", "w-20", "w-28", "w-16", "w-24", "w-12"] as const;

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/**
 * Placeholder for a data table: a header strip and `rows` shimmer rows in the
 * same card chrome the real tables use, so the swap to real data doesn't move
 * anything. Purely decorative — the surrounding region owns the announcement.
 */
export function TableSkeleton({ rows = 6, columns = 5, className }: TableSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("overflow-hidden rounded-xl border border-border/60 bg-card", className)}
    >
      <div className="flex items-center gap-4 border-b border-border/60 bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }).map((_, column) => (
          <Skeleton
            key={column}
            className={cn("h-3 motion-reduce:animate-none", CELL_WIDTHS[column % CELL_WIDTHS.length])}
          />
        ))}
      </div>

      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: columns }).map((_, column) => (
              <Skeleton
                key={column}
                className={cn(
                  "h-4 motion-reduce:animate-none",
                  CELL_WIDTHS[(row + column) % CELL_WIDTHS.length]
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
