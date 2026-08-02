import { useState } from "react";

import { Button } from "@/components/ui/button";
import { previewBroadcastAudience } from "@/lib/api/admin-api";
import type { AudiencePreviewOut, BroadcastAudience } from "@/lib/api/broadcast-types";
import { validateAudience } from "@/features/admin/screens/governance/AudienceBuilder";

/** What a preview was taken against — the pair that determines its numbers. */
export interface PreviewSnapshot {
  audience: BroadcastAudience;
  type: string | undefined;
}

/**
 * Structural equality for `{ audience, type }` snapshots. Written by hand
 * instead of pulling in a dependency: the shape is small and fully known
 * (`BroadcastAudience`'s fields are all primitives or a string array), so a
 * direct field-by-field comparison is both correct and easy to audit.
 *
 * Careful with the two footguns deep-equality usually trips on:
 * - key order: we compare specific named fields, never object identity or
 *   `JSON.stringify`, so `{a,b}` and `{b,a}` compare equal.
 * - optional fields: `undefined` and "absent" are treated the same via `??`
 *   defaults / `undefined` comparisons below, so `{ role: undefined }` and
 *   `{}` compare equal, and switching audience type (which drops unrelated
 *   optional fields per AudienceBuilder) is compared on the fields that
 *   actually matter for each type rather than tripping on leftover keys.
 */
function snapshotsEqual(a: PreviewSnapshot, b: PreviewSnapshot): boolean {
  if (a.type !== b.type) return false;
  if (a.audience.type !== b.audience.type) return false;
  if (a.audience.role !== b.audience.role) return false;
  if (a.audience.inactiveDays !== b.audience.inactiveDays) return false;
  if (a.audience.onboardingStatus !== b.audience.onboardingStatus) return false;

  const aIds = a.audience.userIds ?? [];
  const bIds = b.audience.userIds ?? [];
  if (aIds.length !== bIds.length) return false;
  for (let i = 0; i < aIds.length; i++) {
    if (aIds[i] !== bIds[i]) return false;
  }

  return true;
}

interface BroadcastPreviewProps {
  audience: BroadcastAudience;
  /** Notification type the broadcast will actually send as, if selected yet. */
  type?: string;
  /**
   * Called with the preview result and the exact `{ audience, type }` it was
   * taken against, so the caller (and `canSend`) can detect staleness even
   * if it forgets to latch `dirtySincePreview` on every relevant change.
   */
  onPreviewed: (preview: AudiencePreviewOut, snapshot: PreviewSnapshot) => void;
}

/**
 * Recipient-count dry run for the broadcast composer. Firing this on every
 * keystroke in the audience builder would hit the database on every
 * character typed into the user-ids textarea, so it is only ever triggered
 * by the explicit "Preview audience" button.
 *
 * `suppressedByOptOut` is surfaced as its own line whenever it is greater
 * than zero, distinct from `total`, so an admin cannot mistake "matched N"
 * for "will reach N" — the opt-out gap is deliberate suppression, not a
 * bug in the pipeline.
 */
export function BroadcastPreview({ audience, type, onPreviewed }: BroadcastPreviewProps) {
  const [preview, setPreview] = useState<AudiencePreviewOut | null>(null);
  const [previewedSnapshot, setPreviewedSnapshot] = useState<PreviewSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationError = validateAudience(audience);
  const isStale =
    preview !== null &&
    (previewedSnapshot === null || !snapshotsEqual(previewedSnapshot, { audience, type }));

  async function handlePreview() {
    setLoading(true);
    setError(null);
    try {
      const result = await previewBroadcastAudience(audience, type);
      const snapshot: PreviewSnapshot = { audience, type };
      setPreview(result);
      setPreviewedSnapshot(snapshot);
      onPreviewed(result, snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview audience");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={handlePreview}
        disabled={Boolean(validationError) || loading}
      >
        {loading ? "Previewing…" : "Preview audience"}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {preview && (
        <div className="rounded-md border p-4 text-sm space-y-1">
          {isStale && (
            <p role="status" className="font-medium text-destructive">
              Audience or type changed since this preview — these numbers are stale.
              Preview again before sending.
            </p>
          )}
          <p>
            <span className="font-medium">Matched:</span> {preview.total.toLocaleString()}{" "}
            <span className="text-muted-foreground">
              ({preview.customers.toLocaleString()} customers, {preview.cleaners.toLocaleString()} cleaners)
            </span>
          </p>
          <p>
            <span className="font-medium">Reachable by push:</span>{" "}
            {preview.reachableByPush.toLocaleString()}
          </p>
          {preview.suppressedByOptOut > 0 && (
            <p role="status" className="font-medium text-destructive">
              {preview.suppressedByOptOut.toLocaleString()} people were excluded for having marketing
              notifications opted out — actual delivery will reach{" "}
              {preview.reachableByPush.toLocaleString()}, not {preview.total.toLocaleString()}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface CanSendArgs {
  preview: AudiencePreviewOut | null;
  audience: BroadcastAudience;
  /** Notification type the broadcast will actually send as, if selected yet. */
  type?: string;
  /**
   * True whenever the caller believes the audience (or type) has been
   * edited since `preview` was taken. This is the primary signal — set by
   * the caller (Task 5) as an explicit latch: cleared right after a
   * successful preview, set on any subsequent edit to audience or type.
   * A latch rather than a recomputed diff, so it can't be fooled by an
   * audience round-tripping back to an equal-looking value.
   */
  dirtySincePreview: boolean;
  /**
   * The exact `{ audience, type }` pair `preview` was taken against, as
   * returned by `BroadcastPreview`'s `onPreviewed`. This is the backstop:
   * even if the caller forgets to latch `dirtySincePreview` on some edit
   * path (e.g. a type selector wired up separately from the audience
   * builder), comparing the live audience/type against this snapshot still
   * catches the mismatch. Optional so existing single-audience callers
   * degrade to relying on the latch alone — degrading safety only if the
   * caller opts out, never silently.
   */
  previewedSnapshot?: PreviewSnapshot | null;
}

/**
 * The send gate. Pure and framework-free so Task 5 can wire it directly to
 * the send button and Task 8 can assert on it in a browser without
 * rendering anything.
 *
 * A send is authorized only when:
 * - a preview exists,
 * - the caller's own dirty-tracking says the audience/type haven't changed
 *   since that preview, AND the preview's recorded snapshot still matches
 *   the current audience/type (defense-in-depth: this can only make the
 *   gate stricter, never looser, so a caller that gets the latch right
 *   gains nothing extra to worry about, and a caller that forgets it is
 *   still caught), and
 * - the audience is currently valid.
 *
 * The snapshot check exists because `dirtySincePreview` alone is only as
 * good as the caller's discipline: if the notification type is tracked in
 * a separate piece of state with its own handler, it is easy to latch
 * dirty on audience edits and forget to do so on a type change, leaving
 * `canSend` authorizing a send under opt-out numbers computed for the
 * wrong type. The snapshot comparison does not depend on the caller
 * remembering anything.
 */
export function canSend({
  preview,
  audience,
  type,
  dirtySincePreview,
  previewedSnapshot,
}: CanSendArgs): boolean {
  if (!preview) return false;
  if (dirtySincePreview) return false;
  if (previewedSnapshot && !snapshotsEqual(previewedSnapshot, { audience, type })) return false;
  if (validateAudience(audience)) return false;
  return true;
}
