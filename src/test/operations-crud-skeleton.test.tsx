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

    // Query for the TableSkeleton by looking for the specific structure:
    // a div with aria-hidden="true" that contains a border-b header and a divide-y rows container.
    const skeleton = container.querySelector('div[aria-hidden="true"] > div.border-b');
    expect(skeleton).toBeTruthy();

    // Verify the old loading text is not present
    expect(screen.queryByText(/loading records/i)).not.toBeInTheDocument();
  });
});
