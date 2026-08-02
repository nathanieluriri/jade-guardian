import { useState } from "react";

import { Button } from "@/components/ui/button";
import { previewBroadcastAudience } from "@/lib/api/admin-api";
import type { AudiencePreviewOut, BroadcastAudience } from "@/lib/api/broadcast-types";
import { validateAudience } from "@/features/admin/screens/governance/AudienceBuilder";

interface BroadcastPreviewProps {
  audience: BroadcastAudience;
  /** Notification type the broadcast will actually send as, if selected yet. */
  type?: string;
  onPreviewed: (preview: AudiencePreviewOut) => void;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationError = validateAudience(audience);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    try {
      const result = await previewBroadcastAudience(audience, type);
      setPreview(result);
      onPreviewed(result);
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
  /**
   * True whenever the audience has been edited since `preview` was taken.
   * Determined by the caller (Task 5) as a deep-equality check between the
   * previewed audience and the current one — see BroadcastPreview.tsx for
   * rationale. Kept as an explicit flag here, not recomputed internally, so
   * `canSend` stays a trivial pure function with a single obvious contract:
   * given the three facts, decide.
   */
  dirtySincePreview: boolean;
}

/**
 * The send gate. Pure and framework-free so Task 5 can wire it directly to
 * the send button and Task 8 can assert on it in a browser without
 * rendering anything.
 *
 * A send is authorized only when:
 * - a preview exists,
 * - the audience has not been edited since that preview was taken, and
 * - the audience is currently valid.
 *
 * The middle condition is the one that matters most: a preview taken for
 * audience A must never authorize a send to audience B. Whoever calls this
 * decides how `dirtySincePreview` is computed (see the field doc above);
 * `canSend` only enforces the resulting rule.
 */
export function canSend({ preview, audience, dirtySincePreview }: CanSendArgs): boolean {
  if (!preview) return false;
  if (dirtySincePreview) return false;
  if (validateAudience(audience)) return false;
  return true;
}
