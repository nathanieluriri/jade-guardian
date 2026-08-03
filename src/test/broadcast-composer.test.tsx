import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BroadcastComposer } from "@/features/admin/screens/governance/BroadcastComposer";
import type { AudiencePreviewOut } from "@/lib/api/broadcast-types";
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

const types = ["promo.broadcast", "system.alert"];

function setup() {
  vi.spyOn(adminApi, "fetchNotificationTypes").mockResolvedValue(types);
  vi.spyOn(adminApi, "previewBroadcastAudience").mockResolvedValue(preview);
}

async function fillMessage(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/title/i), "Big sale");
  await user.type(screen.getByLabelText(/body|message/i), "Everything is 50% off this weekend.");
}

async function doPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /preview/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^send/i })).not.toBeDisabled(),
  );
}

describe("BroadcastComposer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads notification types and defaults to promo.broadcast", async () => {
    setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());
    expect(await screen.findByText("promo.broadcast")).toBeInTheDocument();
  });

  it("degrades gracefully when the notification type list fails to load", async () => {
    vi.spyOn(adminApi, "fetchNotificationTypes").mockRejectedValue(new Error("boom"));
    vi.spyOn(adminApi, "previewBroadcastAudience").mockResolvedValue(preview);
    const user = userEvent.setup();
    render(<BroadcastComposer />);

    // Falls back to the server's default type as the sole option.
    expect(await screen.findByText("promo.broadcast")).toBeInTheDocument();
    // Surfaces an honest note explaining the fallback.
    expect(screen.getByText(/couldn.t load the notification type list/i)).toBeInTheDocument();

    // Rest of the composer keeps working: fill, preview, send gate behaves normally.
    await fillMessage(user);
    expect(screen.getByRole("button", { name: /^send/i })).toBeDisabled();
    await doPreview(user);
  });

  it("caps title at 120 chars and body at 500 chars", async () => {
    setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    const bodyInput = screen.getByLabelText(/body|message/i) as HTMLTextAreaElement;

    expect(titleInput.maxLength).toBe(120);
    expect(bodyInput.maxLength).toBe(500);
  });

  it("disables send until title and body are present", async () => {
    setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /^send/i })).toBeDisabled();
  });

  it("disables send until a successful preview has been taken", async () => {
    setup();
    const user = userEvent.setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());

    await fillMessage(user);
    expect(screen.getByRole("button", { name: /^send/i })).toBeDisabled();

    await doPreview(user);
  });

  it("re-disables send when the audience changes after preview", async () => {
    setup();
    const user = userEvent.setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());
    await fillMessage(user);
    await doPreview(user);

    // Switch audience type -> should re-disable send.
    await user.click(screen.getByLabelText(/all customers/i));

    expect(screen.getByRole("button", { name: /^send/i })).toBeDisabled();
  });

  // The case most likely to be missed: type-only changes must also
  // re-disable send, since opt-out suppression is computed per type.
  it("re-disables send when only the notification type changes after preview", async () => {
    setup();
    const user = userEvent.setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());
    await fillMessage(user);
    await doPreview(user);

    fireEvent.click(screen.getByRole("combobox", { name: /notification type/i }));
    const option = await screen.findByText("system.alert");
    fireEvent.click(option);

    expect(screen.getByRole("button", { name: /^send/i })).toBeDisabled();
  });

  it("sends with the exact nested payload shape and shows a confirmation", async () => {
    setup();
    const createSpy = vi
      .spyOn(adminApi, "createBroadcast_v2")
      .mockResolvedValue({
        id: "b1",
        title: "Big sale",
        body: "Everything is 50% off this weekend.",
        type: "promo.broadcast",
        audience: { type: "ALL" },
        status: "QUEUED",
        promoId: null,
        promoCode: null,
        data: null,
        recipientCount: 0,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        createdBy: null,
        dispatchedAt: null,
        completedAt: null,
        dateCreated: null,
        lastUpdated: null,
      });

    const user = userEvent.setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());
    await fillMessage(user);
    await doPreview(user);

    await user.click(screen.getByRole("button", { name: /^send/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith({
      title: "Big sale",
      body: "Everything is 50% off this weekend.",
      audience: { type: "ALL" },
      type: "promo.broadcast",
    });

    expect(await screen.findByText(/sent|queued|success/i)).toBeInTheDocument();
  });

  it("fires createBroadcast_v2 exactly once on a rapid double-click", async () => {
    setup();
    const createSpy = vi
      .spyOn(adminApi, "createBroadcast_v2")
      .mockResolvedValue({
        id: "b1",
        title: "Big sale",
        body: "Everything is 50% off this weekend.",
        type: "promo.broadcast",
        audience: { type: "ALL" },
        status: "QUEUED",
        promoId: null,
        promoCode: null,
        data: null,
        recipientCount: 0,
        processedCount: 0,
        sentCount: 0,
        failedCount: 0,
        createdBy: null,
        dispatchedAt: null,
        completedAt: null,
        dateCreated: null,
        lastUpdated: null,
      });

    const user = userEvent.setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());
    await fillMessage(user);
    await doPreview(user);

    const sendButton = screen.getByRole("button", { name: /^send/i });
    // Fire two clicks without awaiting between them — simulates the async
    // setState window a rapid double-click lands in.
    fireEvent.click(sendButton);
    fireEvent.click(sendButton);

    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    // Give any second in-flight call a chance to land before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("does not clear the composed message on a failed send", async () => {
    setup();
    vi.spyOn(adminApi, "createBroadcast_v2").mockRejectedValue(new Error("network down"));

    const user = userEvent.setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());
    await fillMessage(user);
    await doPreview(user);

    await user.click(screen.getByRole("button", { name: /^send/i }));

    await waitFor(() => expect(screen.getByText(/network down/i)).toBeInTheDocument());

    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe("Big sale");
    expect((screen.getByLabelText(/body|message/i) as HTMLTextAreaElement).value).toBe(
      "Everything is 50% off this weekend.",
    );
  });
});
