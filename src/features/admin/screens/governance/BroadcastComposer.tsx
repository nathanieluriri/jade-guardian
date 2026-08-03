"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchNotificationTypes, createBroadcast_v2 } from "@/lib/api/admin-api";
import {
  AUDIENCE_TYPES,
  type AudiencePreviewOut,
  type BroadcastAudience,
} from "@/lib/api/broadcast-types";
import { AudienceBuilder } from "@/features/admin/screens/governance/AudienceBuilder";
import {
  BroadcastPreview,
  canSend,
  type PreviewSnapshot,
} from "@/features/admin/screens/governance/BroadcastPreview";
import { TemplatePicker, SaveAsTemplateButton } from "@/features/admin/templates/TemplatePicker";

const TITLE_MAX = 120;
const BODY_MAX = 500;
const DEFAULT_TYPE = "promo.broadcast";

const EMPTY_AUDIENCE: BroadcastAudience = { type: "ALL" };

/**
 * Guards a template's `audience` field before it's applied. A template
 * payload is stored as `z.record(z.string(), z.unknown())` server-side, so
 * it can legitimately carry an array, null, or an object with a `type` that
 * isn't one of `AUDIENCE_TYPES` (e.g. from a stale/renamed audience type).
 * Only a shape recognisable as a `BroadcastAudience` is applied — anything
 * else is left alone rather than risk crashing `AudienceBuilder`/`validateAudience`.
 */
function isValidAudienceShape(value: unknown): value is BroadcastAudience {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" && (AUDIENCE_TYPES as readonly string[]).includes(type);
}

/**
 * Assembles the broadcast composer: title/body fields, the notification
 * type picker, the audience builder, the recipient preview, and the send
 * action.
 *
 * Send is gated entirely by `canSend` (Task 4) — this component's only job
 * is to feed it honest inputs:
 * - `dirtySincePreview` is latched here as an explicit boolean: cleared the
 *   instant `onPreviewed` fires, and set on *any* subsequent edit to either
 *   the audience or the notification type. Both paths matter because the
 *   backend computes opt-out suppression per type, so a type-only change
 *   invalidates a preview just as much as an audience change does.
 * - `previewedSnapshot` is stored verbatim from `onPreviewed`'s second
 *   argument, never recomputed, so `canSend`'s backstop check compares
 *   against the exact pair the preview was taken against.
 *
 * A failed send intentionally leaves `title`/`body`/`audience` untouched —
 * only `sendError` and the pending flag reset — so a transient network
 * failure never costs an admin their drafted platform-wide message.
 */
export function BroadcastComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<BroadcastAudience>(EMPTY_AUDIENCE);
  const [notificationTypes, setNotificationTypes] = useState<string[]>([]);
  const [type, setType] = useState<string | undefined>(undefined);
  const [typesLoadError, setTypesLoadError] = useState(false);

  const [preview, setPreview] = useState<AudiencePreviewOut | null>(null);
  const [previewedSnapshot, setPreviewedSnapshot] = useState<PreviewSnapshot | null>(null);
  const [dirtySincePreview, setDirtySincePreview] = useState(true);

  const [templateRefreshKey, setTemplateRefreshKey] = useState(0);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);
  // `useState` is asynchronous: two rapid clicks can both read `sending`
  // as `false` before the first click's `setSending(true)` commits, so
  // `sending` alone leaves a window for `createBroadcast_v2` to fire
  // twice — duplicate delivery to every user on the platform. A ref is
  // mutated synchronously, so the *second* click of a double-click sees
  // the first click's guard immediately, before any re-render happens.
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchNotificationTypes()
      .then((types) => {
        if (cancelled) return;
        setNotificationTypes(types);
        if (types.includes(DEFAULT_TYPE)) {
          setType(DEFAULT_TYPE);
        } else if (types.length > 0) {
          setType(types[0]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Type list is a convenience picker, not a hard requirement to
        // compose. The route-level permission check only covers
        // `GET /v1/admins/notifications/broadcasts` (list/send), not the
        // types catalogue — an admin can legitimately land here without
        // rights to `GET /v1/admins/notifications/types`. Degrade to the
        // server's own default rather than leaving the picker empty or
        // broken, and say so, so the admin knows why their choices are
        // limited. The rest of the composer (audience builder, preview,
        // send) must keep working regardless.
        setNotificationTypes([DEFAULT_TYPE]);
        setType(DEFAULT_TYPE);
        setTypesLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleAudienceChange(next: BroadcastAudience) {
    setAudience(next);
    setDirtySincePreview(true);
  }

  function handleTypeChange(next: string) {
    setType(next);
    setDirtySincePreview(true);
  }

  function handlePreviewed(nextPreview: AudiencePreviewOut, snapshot: PreviewSnapshot) {
    setPreview(nextPreview);
    setPreviewedSnapshot(snapshot);
    setDirtySincePreview(false);
  }

  // A template can carry an audience (and a type), and a stale preview taken
  // against a *different* audience must never be allowed to authorise a send
  // against this one. So this routes the audience/type through the exact
  // same handlers a manual edit would use — `handleAudienceChange` and
  // `handleTypeChange` — rather than calling `setAudience`/`setType`
  // directly, so `dirtySincePreview` is latched the normal way. Title/body
  // are filled directly since they're not part of `canSend`'s gate.
  function applyTemplate(payload: Record<string, unknown>) {
    if (typeof payload.title === "string") {
      setTitle(payload.title);
    }
    if (typeof payload.body === "string") {
      setBody(payload.body);
    }
    if (typeof payload.type === "string") {
      handleTypeChange(payload.type);
    }
    if (isValidAudienceShape(payload.audience)) {
      handleAudienceChange(payload.audience);
    }
  }

  const titleValid = title.trim().length > 0 && title.length <= TITLE_MAX;
  const bodyValid = body.trim().length > 0 && body.length <= BODY_MAX;

  const sendAuthorized =
    titleValid &&
    bodyValid &&
    canSend({ preview, audience, type, dirtySincePreview, previewedSnapshot });

  async function handleSend() {
    // Re-assert authorisation and in-flight status here rather than
    // trusting the button's `disabled` prop — that prop only reflects the
    // last committed render, which is exactly the window a rapid
    // double-click lands in. `sendInFlightRef` is checked and set
    // synchronously so the second click of a double-click bails
    // immediately, before `createBroadcast_v2` is called a second time.
    if (sendInFlightRef.current || !sendAuthorized) return;
    sendInFlightRef.current = true;
    setSending(true);
    setSendError(null);
    try {
      const result = await createBroadcast_v2({ title, body, audience, type });
      // A successful send must consume the preview it was authorised
      // against: `preview`/`previewedSnapshot` still describe an audience
      // that has now already been sent to, so leaving the gate open would
      // let a second click (the admin re-checking the still-populated form)
      // re-send to every user on the platform. Latching `dirtySincePreview`
      // is the same mechanism an audience/type edit uses, so `canSend` closes
      // the gate through its normal path rather than a special case.
      setDirtySincePreview(true);
      setPreview(null);
      setPreviewedSnapshot(null);
      setSendResult(
        `Broadcast sent (status: ${result.status.toLowerCase()}). Preview the audience again before sending another broadcast.`,
      );
    } catch (err) {
      // Deliberately do not touch title/body/audience here — a failed send
      // must not cost the admin their drafted message.
      setSendError(err instanceof Error ? err.message : "Failed to send broadcast");
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div className="flex-1">
          <TemplatePicker feature="broadcasts" onApply={applyTemplate} refreshKey={templateRefreshKey} />
        </div>
        <SaveAsTemplateButton
          feature="broadcasts"
          payload={{ title, body, type, audience }}
          onSaved={() => setTemplateRefreshKey((key) => key + 1)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="broadcast-title">Title</Label>
        <Input
          id="broadcast-title"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {title.length} / {TITLE_MAX}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="broadcast-body">Message</Label>
        <Textarea
          id="broadcast-body"
          value={body}
          maxLength={BODY_MAX}
          onChange={(event) => setBody(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {body.length} / {BODY_MAX}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="broadcast-type">Notification type</Label>
        <Select value={type ?? ""} onValueChange={handleTypeChange}>
          <SelectTrigger id="broadcast-type" aria-label="Notification type">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            {notificationTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {typesLoadError && (
          <p className="text-xs text-muted-foreground">
            Couldn&apos;t load the notification type list, so only the default (
            {DEFAULT_TYPE}) is available right now.
          </p>
        )}
      </div>

      <AudienceBuilder value={audience} onChange={handleAudienceChange} />

      <BroadcastPreview audience={audience} type={type} onPreviewed={handlePreviewed} />

      {sendError && <p className="text-sm text-destructive">{sendError}</p>}
      {sendResult && (
        <p role="status" className="text-sm text-emerald-600">
          {sendResult}
        </p>
      )}

      <Button
        type="button"
        onClick={() => {
          void handleSend();
        }}
        disabled={!sendAuthorized || sending}
      >
        {sending ? "Sending…" : "Send broadcast"}
      </Button>
    </div>
  );
}
