import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import {
  BroadcastPreview,
  canSend,
} from "@/features/admin/screens/governance/BroadcastPreview";
import type { AudiencePreviewOut, BroadcastAudience } from "@/lib/api/broadcast-types";
import * as adminApi from "@/lib/api/admin-api";

const preview: AudiencePreviewOut = {
  audience: { type: "ALL" },
  total: 5000,
  customers: 3000,
  cleaners: 2000,
  reachableByPush: 4200,
  matchedBeforeOptOut: 4800,
  suppressedByOptOut: 600,
};

const zeroSuppressedPreview: AudiencePreviewOut = {
  ...preview,
  matchedBeforeOptOut: preview.total,
  suppressedByOptOut: 0,
};

describe("canSend", () => {
  const audience: BroadcastAudience = { type: "ALL" };
  const matchingSnapshot = { audience, type: undefined };

  it("no preview yet -> false", () => {
    expect(
      canSend({
        preview: null,
        audience,
        dirtySincePreview: false,
        previewedSnapshot: null,
      }),
    ).toBe(false);
  });

  it("preview present, audience unchanged since -> true", () => {
    expect(
      canSend({
        preview,
        audience,
        dirtySincePreview: false,
        previewedSnapshot: matchingSnapshot,
      }),
    ).toBe(true);
  });

  it("preview present but audience edited afterwards -> false (stale)", () => {
    expect(
      canSend({
        preview,
        audience,
        dirtySincePreview: true,
        previewedSnapshot: matchingSnapshot,
      }),
    ).toBe(false);
  });

  it("audience invalid -> false even with a preview present", () => {
    const invalidAudience: BroadcastAudience = { type: "USER_IDS" };
    expect(
      canSend({
        preview: { ...preview, audience: invalidAudience },
        audience: invalidAudience,
        dirtySincePreview: false,
        previewedSnapshot: { audience: invalidAudience, type: undefined },
      }),
    ).toBe(false);
  });

  // The finding this backstop exists for: a caller might latch
  // `dirtySincePreview` only on audience edits and forget the notification
  // type is a separate piece of state with its own handler. Opt-out
  // suppression is computed per type, so a type-only change must still
  // invalidate the preview even when the latch was (wrongly) left `false`.
  it("type changed since preview, latch left false -> false (snapshot backstop)", () => {
    const previewedSnapshot = { audience, type: "promo.broadcast" };
    expect(
      canSend({
        preview,
        audience,
        type: "system.alert",
        dirtySincePreview: false,
        previewedSnapshot,
      }),
    ).toBe(false);
  });

  it("type unchanged since preview, snapshot matches -> true", () => {
    const previewedSnapshot = { audience, type: "promo.broadcast" };
    expect(
      canSend({
        preview,
        audience,
        type: "promo.broadcast",
        dirtySincePreview: false,
        previewedSnapshot,
      }),
    ).toBe(true);
  });

  // `previewedSnapshot` is required in `CanSendArgs` precisely so this case
  // cannot arise silently: a preview exists but the caller passed no
  // snapshot for it (e.g. lost track of what `onPreviewed` handed back).
  // TypeScript rejects the omission at compile time; at the value level,
  // a null snapshot alongside a non-null preview is treated as stale
  // rather than as "trust the latch" — there is no honest path back to the
  // old degraded behavior.
  it("preview present but snapshot is null -> false (never falls back to trusting the latch)", () => {
    expect(
      canSend({
        preview,
        audience,
        dirtySincePreview: false,
        previewedSnapshot: null,
      }),
    ).toBe(false);
  });
});

describe("BroadcastPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not preview automatically; only on button click", async () => {
    const spy = vi
      .spyOn(adminApi, "previewBroadcastAudience")
      .mockResolvedValue(preview);
    render(
      <BroadcastPreview audience={{ type: "ALL" }} onPreviewed={() => {}} />,
    );

    expect(spy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("renders total, reachableByPush and shows a warning when suppressedByOptOut > 0", async () => {
    vi.spyOn(adminApi, "previewBroadcastAudience").mockResolvedValue(preview);
    const onPreviewed = vi.fn();
    render(
      <BroadcastPreview audience={{ type: "ALL" }} onPreviewed={onPreviewed} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() =>
      expect(onPreviewed).toHaveBeenCalledWith(preview, {
        audience: { type: "ALL" },
        type: undefined,
      }),
    );

    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4,200/).length).toBeGreaterThan(0);
    expect(screen.getByText(/600/)).toBeInTheDocument();
    // The gap between matched and reached should be called out as a warning.
    expect(screen.getByRole("status")).toHaveTextContent(/opt.*out/i);
  });

  it("does not show a warning when suppressedByOptOut is 0", async () => {
    vi.spyOn(adminApi, "previewBroadcastAudience").mockResolvedValue(
      zeroSuppressedPreview,
    );
    render(
      <BroadcastPreview audience={{ type: "ALL" }} onPreviewed={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() =>
      expect(screen.getByText(/5,000/)).toBeInTheDocument(),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a stale banner in the panel itself once the audience changes after preview", async () => {
    vi.spyOn(adminApi, "previewBroadcastAudience").mockResolvedValue(preview);
    const { rerender } = render(
      <BroadcastPreview audience={{ type: "ALL" }} onPreviewed={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() =>
      expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/stale/i)).not.toBeInTheDocument();

    // Audience changes underneath the already-rendered panel (e.g. the
    // admin edits the audience builder after previewing).
    rerender(
      <BroadcastPreview
        audience={{ type: "ALL_CUSTOMERS" }}
        onPreviewed={() => {}}
      />,
    );

    expect(screen.getByText(/stale/i)).toBeInTheDocument();
    // The old numbers are still shown, just clearly flagged as outdated —
    // silently hiding them would be its own kind of surprise.
    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0);
  });

  it("disables the preview button while an invalid audience is selected", () => {
    render(
      <BroadcastPreview
        audience={{ type: "USER_IDS" }}
        onPreviewed={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /preview/i })).toBeDisabled();
  });
});
