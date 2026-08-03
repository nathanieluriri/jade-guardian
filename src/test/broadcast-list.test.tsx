import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    expect(screen.getByText(/^400 of (1000|1,000)$/)).toBeInTheDocument();
    expect(screen.getByText("390")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
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

  it("an in-flight action on one row does not block or no-op a different row's action", async () => {
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockResolvedValue({
      items: [
        makeBroadcast({ id: "b1", status: "QUEUED", title: "Row A" }),
        makeBroadcast({ id: "b2", status: "QUEUED", title: "Row B" }),
      ],
      nextCursor: null,
      pageSize: 20,
    });

    let resolveRowA: ((value: BroadcastOut) => void) | undefined;
    const resumeSpy = vi
      .spyOn(adminApi, "resumeBroadcast")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRowA = resolve;
          }),
      )
      .mockResolvedValueOnce(makeBroadcast({ id: "b2", status: "SENDING", title: "Row B" }));

    const user = userEvent.setup();
    render(<BroadcastList />);

    await screen.findByText("Row A");
    const resumeButtons = screen.getAllByRole("button", { name: /resume/i });

    // Start row A's action and leave it in flight.
    await user.click(resumeButtons[0]);
    expect(resumeSpy).toHaveBeenCalledTimes(1);

    // Row A's own button now shows busy and is disabled...
    expect(screen.getByRole("button", { name: /resuming/i })).toBeDisabled();

    // ...but row B's button must still be enabled and must actually fire a
    // request when clicked, not silently no-op.
    const rowBButton = screen.getAllByRole("button", { name: /^resume$/i })[0];
    expect(rowBButton).toBeEnabled();
    await user.click(rowBButton);

    await waitFor(() => expect(resumeSpy).toHaveBeenCalledTimes(2));
    expect(resumeSpy).toHaveBeenNthCalledWith(2, "b2");

    // Clean up the still-pending row A call.
    resolveRowA?.(makeBroadcast({ id: "b1", status: "SENDING", title: "Row A" }));
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

  it("fires only one additional listNotificationBroadcasts call on a rapid double-click of Load more", async () => {
    let resolveSecondCall: (() => void) | undefined;
    const listSpy = vi
      .spyOn(adminApi, "listNotificationBroadcasts")
      .mockResolvedValueOnce({
        items: [makeBroadcast({ id: "b1", title: "First page" })],
        nextCursor: "cursor-2",
        pageSize: 20,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondCall = () =>
              resolve({
                items: [makeBroadcast({ id: "b2", title: "Second page" })],
                nextCursor: null,
                pageSize: 20,
              });
          }),
      );

    render(<BroadcastList />);

    await screen.findByText("First page");
    const loadMore = screen.getByRole("button", { name: /load more/i });

    // Fire two clicks without awaiting between them — simulates the async
    // setState window a rapid double-click lands in.
    fireEvent.click(loadMore);
    fireEvent.click(loadMore);

    // Let the guard's synchronous check run for both queued clicks before
    // resolving the in-flight fetch. One call already happened on mount
    // (the first page); the guard should let exactly one more through for
    // the two rapid Load more clicks, not two.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listSpy).toHaveBeenCalledTimes(2);

    resolveSecondCall?.();
    await screen.findByText("Second page");

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("First page")).toHaveLength(1);
    expect(screen.getAllByText("Second page")).toHaveLength(1);
  });
});
