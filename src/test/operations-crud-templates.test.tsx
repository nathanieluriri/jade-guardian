import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FeatureTemplate } from "@/lib/api/template-types";

const listFeatureTemplates = vi.fn();
const createFeatureTemplate = vi.fn();

vi.mock("@/lib/api/admin-api", () => ({
  listFeatureTemplates: (...args: unknown[]) => listFeatureTemplates(...args),
  createFeatureTemplate: (...args: unknown[]) => createFeatureTemplate(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));
vi.mock("@/lib/admin-access", () => ({ canAccessAdminAction: () => true }));

import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

function makeTemplate(overrides: Partial<FeatureTemplate> = {}): FeatureTemplate {
  return {
    id: "t1",
    feature: "service-definitions",
    name: "Standard Clean",
    description: undefined,
    payload: { display_name: "Deep Clean" },
    dateCreated: null,
    lastUpdated: null,
    ...overrides,
  };
}

function renderPage(overrides: Partial<React.ComponentProps<typeof OperationsCrudPage>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
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
        listFn={async () => []}
        createFn={async () => ({})}
        updateFn={async () => ({})}
        deleteFn={async () => ({})}
        {...overrides}
      />
    </QueryClientProvider>,
  );
}

describe("OperationsCrudPage templates", () => {
  beforeEach(() => {
    listFeatureTemplates.mockReset();
    createFeatureTemplate.mockReset();
  });

  it("renders no picker and issues no fetch when templateFeature is absent (the other seven consumers)", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /new|create|add/i }));

    expect(screen.queryByText(/start from a template/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no templates saved/i)).not.toBeInTheDocument();
    // Give any accidental async fetch a tick to fire before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listFeatureTemplates).not.toHaveBeenCalled();
  });

  it("applies a template's payload into the visible form fields", async () => {
    const user = userEvent.setup();
    listFeatureTemplates.mockResolvedValueOnce([makeTemplate()]);

    renderPage({ templateFeature: "service-definitions" });

    await user.click(await screen.findByRole("button", { name: /new|create|add/i }));
    await user.click(await screen.findByText("Standard Clean"));

    expect(await screen.findByLabelText(/display name/i)).toHaveValue("Deep Clean");
  });

  it("leaves submit disabled when the applied template omits a required field, exactly as typed input would", async () => {
    const user = userEvent.setup();
    listFeatureTemplates.mockResolvedValueOnce([
      makeTemplate({ id: "t2", name: "Missing Name", payload: { display_name: "" } }),
    ]);

    renderPage({ templateFeature: "service-definitions" });

    await user.click(await screen.findByRole("button", { name: /new|create|add/i }));
    await user.click(await screen.findByText("Missing Name"));

    expect(screen.getByTestId("crud-submit")).toBeDisabled();
  });

  it("ignores a template payload key that isn't in this feature's fields, rather than injecting it into the outgoing payload", async () => {
    const user = userEvent.setup();
    const createFn = vi.fn(async () => ({}));
    listFeatureTemplates.mockResolvedValueOnce([
      makeTemplate({
        id: "t3",
        name: "Stale Key",
        payload: { display_name: "Valid Name", removed_legacy_field: "should not appear" },
      }),
    ]);

    renderPage({ templateFeature: "service-definitions", createFn });

    await user.click(await screen.findByRole("button", { name: /new|create|add/i }));
    await user.click(await screen.findByText("Stale Key"));

    const submit = screen.getByTestId("crud-submit");
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);

    await waitFor(() => expect(createFn).toHaveBeenCalledTimes(1));
    const payload = createFn.mock.calls[0][0];
    expect(payload).not.toHaveProperty("removed_legacy_field");
    expect(payload).toEqual({ display_name: "Valid Name" });
  });
});
