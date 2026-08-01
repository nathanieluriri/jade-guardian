import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SessionsPage from "@/features/admin/screens/SessionsPage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));

const fetchSessionAnomalies = vi.fn();
vi.mock("@/lib/api/admin-api", () => ({
  fetchSessionAnomalies: (...args: unknown[]) => fetchSessionAnomalies(...args),
  revokeAllSessions: vi.fn(),
  revokeCurrentSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SessionsPage />
    </QueryClientProvider>,
  );
}

describe("SessionsPage", () => {
  beforeEach(() => {
    fetchSessionAnomalies.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state when no admin has active sessions", async () => {
    fetchSessionAnomalies.mockResolvedValue({
      active_sessions_by_admin: {},
      global_active_sessions: 0,
      long_lived_session_count: 0,
      recent_session_spike_detected: false,
    });

    renderPage();

    expect(await screen.findByText(/no active admin sessions/i)).toBeInTheDocument();
  });

  it("offers a retry when the request fails", async () => {
    fetchSessionAnomalies.mockRejectedValue(new Error("boom"));

    renderPage();

    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
