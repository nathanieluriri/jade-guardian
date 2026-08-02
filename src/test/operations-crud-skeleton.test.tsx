import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));
vi.mock("@/lib/admin-access", () => ({ canAccessAdminAction: () => true }));

describe("OperationsCrudPage loading state", () => {
  it("renders a skeleton shaped like the list while loading", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <OperationsCrudPage
          title="Service Definitions"
          description="test"
          queryKey="service-definitions"
          readRequirement={{ method: "GET", path: "/x" }}
          createRequirement={{ method: "POST", path: "/x" }}
          updateRequirement={{ method: "PATCH", path: "/x" }}
          deleteRequirement={{ method: "DELETE", path: "/x" }}
          fields={[{ key: "display_name", label: "Display Name", type: "text", required: true }]}
          listFn={() => new Promise(() => {})}
          createFn={async () => ({})}
          updateFn={async () => ({})}
          deleteFn={async () => ({})}
        />
      </QueryClientProvider>,
    );

    // Verify TableSkeleton rendered by checking for its root element
    const skeleton = container.querySelector('[data-testid="table-skeleton"]');
    expect(skeleton).toBeTruthy();

    // Verify the expected number of skeleton rows rendered
    const rows = container.querySelectorAll('[data-testid="table-skeleton-row"]');
    expect(rows).toHaveLength(5);

    // Verify the old loading text is not present
    expect(screen.queryByText(/loading records/i)).not.toBeInTheDocument();
  });
});
