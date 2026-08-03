import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RoleTemplatesPage from "@/features/admin/screens/RoleTemplatesPage";

vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchRoleTemplate = vi.fn();
vi.mock("@/lib/api/admin-api", () => ({
  fetchRoleTemplate: (...args: unknown[]) => fetchRoleTemplate(...args),
  fetchPermissionCatalog: vi.fn().mockResolvedValue([]),
  getRoleRolloutImpact: vi.fn().mockResolvedValue({}),
  previewRoleTemplate: vi.fn(),
  rolloutRoleTemplate: vi.fn(),
  updateRoleTemplate: vi.fn(),
}));

const OK_TEMPLATE = { source: "template", permissionList: { permissions: [] } };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RoleTemplatesPage />
    </QueryClientProvider>,
  );
}

describe("RoleTemplatesPage", () => {
  beforeEach(() => {
    fetchRoleTemplate.mockReset();
  });

  it("still renders the customer template when the cleaner template fails", async () => {
    fetchRoleTemplate.mockImplementation((role: string) =>
      role === "cleaner" ? Promise.reject(new Error("boom")) : Promise.resolve(OK_TEMPLATE),
    );

    renderPage();

    // The failing role shows its own error; the healthy role still renders.
    expect(await screen.findByTestId("role-template-error-cleaner")).toBeInTheDocument();
    expect(await screen.findByTestId("role-template-section-customer")).toBeInTheDocument();
    expect(screen.queryByTestId("role-template-error-customer")).not.toBeInTheDocument();
  });

  it("retries only the failed role and recovers it", async () => {
    fetchRoleTemplate.mockImplementation((role: string) =>
      role === "cleaner" ? Promise.reject(new Error("boom")) : Promise.resolve(OK_TEMPLATE),
    );

    renderPage();
    await screen.findByTestId("role-template-error-cleaner");

    const callsBefore = fetchRoleTemplate.mock.calls.length;
    fetchRoleTemplate.mockImplementation(() => Promise.resolve(OK_TEMPLATE));

    fireEvent.click(screen.getByTestId("role-template-retry-cleaner"));

    await waitFor(() => expect(screen.getByTestId("role-template-section-cleaner")).toBeInTheDocument());
    // Assert exactly one additional call, and that it retried the failed "cleaner"
    // role specifically -- not the already-healthy "customer" template, which
    // `toBeGreaterThan` alone would not have distinguished.
    const callsAfter = fetchRoleTemplate.mock.calls.slice(callsBefore);
    expect(callsAfter).toHaveLength(1);
    expect(callsAfter[0][0]).toBe("cleaner");
    expect(screen.queryByTestId("role-template-error-cleaner")).not.toBeInTheDocument();
  });

  it("renders both sections when neither request fails", async () => {
    fetchRoleTemplate.mockResolvedValue(OK_TEMPLATE);

    renderPage();

    expect(await screen.findByTestId("role-template-section-cleaner")).toBeInTheDocument();
    expect(await screen.findByTestId("role-template-section-customer")).toBeInTheDocument();
  });
});
