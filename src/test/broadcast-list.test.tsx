import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BroadcastList } from "@/features/admin/screens/governance/BroadcastList";
import type { BroadcastOut } from "@/lib/api/broadcast-types";
import * as adminApi from "@/lib/api/admin-api";

function makeBroadcast(overrides: Partial<BroadcastOut> = {}): BroadcastOut {
  return {
    id: "b1",
    title: "Weekend sale",
    body: "50% off everything",
    type: "promo.broadcast",
    audience: { type: "ALL" },
    status: "SENDING",
    promoId: null,
    promoCode: null,
    data: null,
    recipientCount: 1000,
    processedCount: 400,
    sentCount: 390,
    failedCount: 10,
    createdBy: "admin1",
    dispatchedAt: 1000,
    completedAt: null,
    dateCreated: 900,
    lastUpdated: 1000,
    ...overrides,
  };
}

describe("BroadcastList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a table skeleton while loading", async () => {
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockImplementation(
      () => new Promise(() => {}),
    );
    render(<BroadcastList />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("renders status and progress for each broadcast", async () => {
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockResolvedValue({
      items: [makeBroadcast()],
      nextCursor: null,
      pageSize: 20,
    });
    render(<BroadcastList />);

    expect(await screen.findByText("Weekend sale")).toBeInTheDocument();
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(screen.getByText(/400/)).toBeInTheDocument();
    expect(screen.getByText(/1000|1,000/)).toBeInTheDocument();
    expect(screen.getByText(/390/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it("offers resume for QUEUED and SENDING but not for SENT", async () => {
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockResolvedValue({
      items: [
        makeBroadcast({ id: "b1", status: "SENDING", title: "Sending sale" }),
        makeBroadcast({ id: "b2", status: "QUEUED", title: "Queued sale" }),
        makeBroadcast({ id: "b3", status: "SENT", title: "Old sale" }),
      ],
      nextCursor: null,
      pageSize: 20,
    });
    render(<BroadcastList />);

    await screen.findByText("Sending sale");
    const resumeButtons = screen.getAllByRole("button", { name: /resume/i });
    expect(resumeButtons).toHaveLength(2);
  });

  it("does not offer resume or cancel for a SENT broadcast", async () => {
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockResolvedValue({
      items: [makeBroadcast({ status: "SENT" })],
      nextCursor: null,
      pageSize: 20,
    });
    render(<BroadcastList />);

    await screen.findByText("Weekend sale");
    expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("does not offer resume or cancel for a FAILED broadcast", async () => {
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockResolvedValue({
      items: [makeBroadcast({ status: "FAILED" })],
      nextCursor: null,
      pageSize: 20,
    });
    render(<BroadcastList />);

    await screen.findByText("Weekend sale");
    expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("offers cancel for in-flight statuses only", async () => {
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockResolvedValue({
      items: [makeBroadcast({ status: "SENDING" })],
      nextCursor: null,
      pageSize: 20,
    });
    render(<BroadcastList />);

    await screen.findByText("Weekend sale");
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("asks for confirmation before cancelling, and only cancels on confirm", async () => {
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockResolvedValue({
      items: [makeBroadcast({ id: "b1", status: "SENDING" })],
      nextCursor: null,
      pageSize: 20,
    });
    const cancelSpy = vi.spyOn(adminApi, "cancelBroadcast").mockResolvedValue(
      makeBroadcast({ id: "b1", status: "CANCELLED" }),
    );
    const user = userEvent.setup();
    render(<BroadcastList />);

    await screen.findByText("Weekend sale");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // Confirmation dialog appears; cancel API not yet called.
    expect(await screen.findByTestId("confirm-dialog")).toBeInTheDocument();
    expect(cancelSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /cancel broadcast/i }));

    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith("b1"));
  });

  it("calls resumeBroadcast when resume is clicked", async () => {
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockResolvedValue({
      items: [makeBroadcast({ id: "b1", status: "QUEUED" })],
      nextCursor: null,
      pageSize: 20,
    });
    const resumeSpy = vi.spyOn(adminApi, "resumeBroadcast").mockResolvedValue(
      makeBroadcast({ id: "b1", status: "SENDING" }),
    );
    const user = userEvent.setup();
    render(<BroadcastList />);

    await screen.findByText("Weekend sale");
    await user.click(screen.getByRole("button", { name: /resume/i }));

    await waitFor(() => expect(resumeSpy).toHaveBeenCalledWith("b1"));
  });

  it("shows a Load more affordance only when nextCursor is present, and pages through it", async () => {
    const listSpy = vi
      .spyOn(adminApi, "listNotificationBroadcasts")
      .mockResolvedValueOnce({
        items: [makeBroadcast({ id: "b1", title: "First page" })],
        nextCursor: "cursor-2",
        pageSize: 20,
      })
      .mockResolvedValueOnce({
        items: [makeBroadcast({ id: "b2", title: "Second page" })],
        nextCursor: null,
        pageSize: 20,
      });
    const user = userEvent.setup();
    render(<BroadcastList />);

    await screen.findByText("First page");
    const loadMore = screen.getByRole("button", { name: /load more/i });
    expect(loadMore).toBeInTheDocument();

    await user.click(loadMore);

    await screen.findByText("Second page");
    expect(listSpy).toHaveBeenLastCalledWith({ cursor: "cursor-2" });
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });
});
