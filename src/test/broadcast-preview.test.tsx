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

  it("no preview yet -> false", () => {
    expect(
      canSend({ preview: null, audience, dirtySincePreview: false }),
    ).toBe(false);
  });

  it("preview present, audience unchanged since -> true", () => {
    expect(
      canSend({ preview, audience, dirtySincePreview: false }),
    ).toBe(true);
  });

  it("preview present but audience edited afterwards -> false (stale)", () => {
    expect(
      canSend({ preview, audience, dirtySincePreview: true }),
    ).toBe(false);
  });

  it("audience invalid -> false even with a preview present", () => {
    const invalidAudience: BroadcastAudience = { type: "USER_IDS" };
    expect(
      canSend({
        preview: { ...preview, audience: invalidAudience },
        audience: invalidAudience,
        dirtySincePreview: false,
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

    await waitFor(() => expect(onPreviewed).toHaveBeenCalledWith(preview));

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
