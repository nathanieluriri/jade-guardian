import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import * as adminApi from "@/lib/api/admin-api";
import { ADMIN_ROUTE_REQUIREMENTS } from "@/lib/admin-access";
import BroadcastsPage from "@/features/admin/screens/governance/BroadcastsPage";

describe("governance/broadcasts route permission requirement", () => {
  it("names the notifications broadcast path, not the legacy CRUD path", () => {
    expect(ADMIN_ROUTE_REQUIREMENTS["/admin/governance/broadcasts"]).toEqual([
      { method: "GET", path: "/v1/admins/notifications/broadcasts" },
    ]);
  });
});

describe("BroadcastsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders both the composer and the list", async () => {
    vi.spyOn(adminApi, "fetchNotificationTypes").mockResolvedValue(["promo.broadcast"]);
    vi.spyOn(adminApi, "listNotificationBroadcasts").mockResolvedValue({
      items: [],
      nextCursor: null,
      pageSize: 25,
    });

    render(<BroadcastsPage />);

    // Composer field
    expect(await screen.findByLabelText(/title/i)).toBeInTheDocument();
    // List heading/table area (loading skeleton or empty state renders synchronously)
    expect(screen.getByRole("button", { name: /preview/i })).toBeInTheDocument();
  });
});
