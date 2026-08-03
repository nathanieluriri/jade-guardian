import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationsCrudPage, type CrudField } from "@/features/admin/screens/operations/OperationsCrudPage";

vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));
vi.mock("@/lib/admin-access", () => ({ canAccessAdminAction: () => true }));

const FIELDS: CrudField[] = [
  { key: "basePrice", label: "Base Price", type: "money" },
  { key: "hourlyRate", label: "Hourly Rate", type: "money" },
];

function renderPage(validateForm?: (values: Record<string, unknown>) => string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OperationsCrudPage
        title="Widgets"
        description="test"
        queryKey="widgets"
        readRequirement={{ method: "GET", path: "/x" }}
        createRequirement={{ method: "POST", path: "/x" }}
        updateRequirement={{ method: "PATCH", path: "/x" }}
        deleteRequirement={{ method: "DELETE", path: "/x" }}
        fields={FIELDS}
        listFn={() => Promise.resolve([])}
        createFn={async () => ({})}
        updateFn={async () => ({})}
        deleteFn={async () => ({})}
        validateForm={validateForm}
      />
    </QueryClientProvider>,
  );
}

function openCreateDialog() {
  fireEvent.click(screen.getByRole("button", { name: /create/i }));
}

describe("OperationsCrudPage validateForm", () => {
  it("disables submit and shows the message when both prices are empty", () => {
    renderPage((values) => {
      const hasBasePrice = String(values.basePrice ?? "").trim().length > 0;
      const hasHourlyRate = String(values.hourlyRate ?? "").trim().length > 0;
      return hasBasePrice || hasHourlyRate ? null : "Set either a base price or an hourly rate.";
    });
    openCreateDialog();

    expect(screen.getByTestId("crud-submit")).toBeDisabled();
    expect(screen.getByTestId("crud-form-error")).toHaveTextContent(
      "Set either a base price or an hourly rate.",
    );
  });

  it("clears the error and enables submit once a price is filled", () => {
    renderPage((values) => {
      const hasBasePrice = String(values.basePrice ?? "").trim().length > 0;
      const hasHourlyRate = String(values.hourlyRate ?? "").trim().length > 0;
      return hasBasePrice || hasHourlyRate ? null : "Set either a base price or an hourly rate.";
    });
    openCreateDialog();

    fireEvent.change(screen.getByLabelText("Base Price"), { target: { value: "25" } });

    expect(screen.queryByTestId("crud-form-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("crud-submit")).not.toBeDisabled();
  });

  it("behaves exactly as before when no validateForm is passed", () => {
    renderPage(undefined);
    openCreateDialog();

    expect(screen.queryByTestId("crud-form-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("crud-submit")).not.toBeDisabled();
  });
});
