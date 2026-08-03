"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
import { useConfirm } from "@/components/recipes/confirm-dialog";
import { cancelBroadcast, listNotificationBroadcasts, resumeBroadcast } from "@/lib/api/admin-api";
import type { BroadcastOut, BroadcastStatus } from "@/lib/api/broadcast-types";

/**
 * Which statuses accept the resume/cancel actions.
 *
 * The backend's `resume` route (`POST /notifications/broadcasts/{id}/resume`)
 * calls `broadcastService.processBatch`, which is a deliberate no-op — it
 * returns the broadcast unchanged with `processed: 0` — for `SENT`,
 * `CANCELLED` *and* `FAILED` (see `app/server/services/broadcast-service.ts`
 * in the backend repo). So offering "Resume" on a `FAILED` broadcast would
 * show a button that does nothing when clicked: worse than not offering it.
 * Only `QUEUED` and `SENDING` are broadcasts the batch processor will
 * actually advance, so those are the only resumable statuses here.
 *
 * `cancelBroadcast` on the backend only rejects `SENT`; everything else,
 * including `FAILED`, is technically accepted. But cancelling something
 * that already stopped moving has no observable effect and reads as a
 * confusing no-op to an operator, so cancel is scoped to the same
 * genuinely in-flight statuses as resume: `QUEUED` and `SENDING`.
 *
 * `DRAFT` never comes back from this backend today (broadcasts are created
 * directly as `QUEUED`), so it is treated conservatively as non-actionable
 * here too — there is nothing in flight to resume or stop.
 */
const RESUMABLE_STATUSES: ReadonlySet<BroadcastStatus> = new Set(["QUEUED", "SENDING"]);
const CANCELLABLE_STATUSES: ReadonlySet<BroadcastStatus> = new Set(["QUEUED", "SENDING"]);

const STATUS_BADGE_VARIANT: Record<BroadcastStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  QUEUED: "secondary",
  SENDING: "default",
  SENT: "secondary",
  FAILED: "destructive",
  CANCELLED: "outline",
};

function formatCount(n: number) {
  return n.toLocaleString();
}

export function BroadcastList() {
  const [items, setItems] = useState<BroadcastOut[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Holds the id of the row currently mid-request, not just a boolean, so
  // an in-flight resume/cancel on one row does not block an action on a
  // different row — the `disabled` prop is per-row (`isBusy`), so the ref
  // guarding it must be too, or a resume on row B while row A is in flight
  // would silently no-op against a button that looks enabled.
  const actionInFlightRef = useRef<string | null>(null);
  const loadMoreInFlightRef = useRef(false);

  const { confirm, confirmDialog } = useConfirm();

  const loadFirstPage = useCallback(() => {
    setLoading(true);
    setError(null);
    listNotificationBroadcasts()
      .then((page) => {
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load broadcasts");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  async function handleLoadMore() {
    // `loadingMore`/`disabled` only reflect the last committed render, which
    // leaves the same double-click window `sendInFlightRef` guards against
    // in BroadcastComposer — a fast second click here would fire the same
    // cursor twice, duplicating a page (and its React keys) in the list.
    if (!nextCursor || loadMoreInFlightRef.current) return;
    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    try {
      const page = await listNotificationBroadcasts({ cursor: nextCursor });
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more broadcasts");
    } finally {
      loadMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }

  function replaceItem(updated: BroadcastOut) {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function handleResume(id: string) {
    if (actionInFlightRef.current !== null) return;
    actionInFlightRef.current = id;
    setBusyId(id);
    try {
      const updated = await resumeBroadcast(id);
      replaceItem(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume broadcast");
    } finally {
      actionInFlightRef.current = null;
      setBusyId(null);
    }
  }

  async function handleCancel(id: string, title: string) {
    // Set the guard synchronously *before* awaiting the confirmation
    // dialog, not after — checking before but setting after leaves a
    // window where two clicks can both pass the check while the dialog is
    // still open. In practice `useConfirm` only ever shows one dialog at a
    // time, so this is a defense-in-depth ordering fix to match the other
    // three in-flight guard sites in this file/composer, not a live bug.
    if (actionInFlightRef.current !== null) return;
    actionInFlightRef.current = id;
    try {
      const confirmed = await confirm({
        title: "Cancel this broadcast?",
        description: `"${title}" is still sending. Recipients already processed will have received it; the rest will not. This cannot be undone.`,
        confirmLabel: "Cancel broadcast",
        cancelLabel: "Keep sending",
        tone: "destructive",
      });
      if (!confirmed) return;

      setBusyId(id);
      const updated = await cancelBroadcast(id);
      replaceItem(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel broadcast");
    } finally {
      actionInFlightRef.current = null;
      setBusyId(null);
    }
  }

  if (loading) {
    return <TableSkeleton rows={6} columns={5} />;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Broadcast</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Sent / Failed</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No broadcasts yet.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const canResume = RESUMABLE_STATUSES.has(item.status);
                const canCancel = CANCELLABLE_STATUSES.has(item.status);
                const isBusy = busyId === item.id;

                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE_VARIANT[item.status]}>
                        {item.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatCount(item.processedCount)} of {formatCount(item.recipientCount)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="text-emerald-600">{formatCount(item.sentCount)}</span>
                      {" / "}
                      <span className={item.failedCount > 0 ? "text-destructive" : undefined}>
                        {formatCount(item.failedCount)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canResume && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => {
                              void handleResume(item.id);
                            }}
                          >
                            {isBusy ? "Resuming…" : "Resume"}
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isBusy}
                            onClick={() => {
                              void handleCancel(item.id, item.title);
                            }}
                          >
                            {isBusy ? "Cancelling…" : "Cancel"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void handleLoadMore()}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
