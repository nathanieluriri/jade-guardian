import type { QueryClient } from "@tanstack/react-query";
import type { AdminResourceItem } from "@/lib/api/types";

/**
 * Shared paging window for the Operations list endpoints (and the sidebar's
 * prefetch of them): a flat first page, no pagination UI yet built for these
 * screens.
 */
export const OPERATIONS_LIST_PAGE = { skip: 0, limit: 100 } as const;

/** A record's id, tolerating both the `id` and Mongo `_id` spellings the API returns. */
export function itemId(item: AdminResourceItem): string {
  const candidate = item.id || item._id;
  return typeof candidate === "string" ? candidate : "";
}

export interface OptimisticDeleteContext {
  previous?: AdminResourceItem[];
}

/**
 * Cache transitions for an optimistic delete, as a factory rather than inline mutation
 * handlers: inline handlers can only be reached by driving the confirmation dialog,
 * which tests the dialog instead of the rollback.
 */
export function optimisticDeleteHandlers(client: QueryClient, queryKey: string) {
  // Must match OperationsCrudPage's own useQuery/invalidateQueries key exactly.
  const key = ["operations", queryKey];

  return {
    async onMutate(id: string): Promise<OptimisticDeleteContext> {
      // Stop an in-flight list refetch from overwriting the optimistic removal.
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<AdminResourceItem[]>(key);
      client.setQueryData<AdminResourceItem[]>(key, (current) =>
        (current ?? []).filter((item) => itemId(item) !== id),
      );
      return { previous };
    },

    onError(_error: unknown, _id: string, context?: OptimisticDeleteContext): void {
      // The server still has the record; put it back.
      if (context?.previous) client.setQueryData(key, context.previous);
    },

    onSettled(): void {
      void client.invalidateQueries({ queryKey: key });
    },
  };
}
