import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
import { cn } from "@/lib/utils";

export interface PageSkeletonProps {
  /** Announced to assistive tech while the route segment streams in. */
  label?: string;
  /** Stat tiles above the body. `0` drops the row entirely. */
  stats?: number;
  /** Body placeholder. Defaults to a table. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Route-level placeholder shared by the admin `loading.tsx` files: page header,
 * an optional stat row and a body block, all token-coloured so the shimmer
 * lands correctly in both themes.
 */
export function PageSkeleton({ label = "Loading page", stats = 4, children, className }: PageSkeletonProps) {
  return (
    <div role="status" aria-busy="true" className={cn("space-y-6 p-1", className)}>
      <span className="sr-only">{label}</span>

      <div aria-hidden="true" className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-80 max-w-full motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl motion-reduce:animate-none" />
      </div>

      {stats > 0 && (
        <div
          aria-hidden="true"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {Array.from({ length: stats }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
              <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
              <Skeleton className="h-7 w-20 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-28 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      )}

      {children ?? <TableSkeleton />}
    </div>
  );
}
