import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));
vi.mock("@/lib/admin-access", () => ({ canAccessAdminAction: () => true }));

function renderPage(createFn: () => Promise<unknown>, deleteFn: () => Promise<unknown> = async () => ({})) {
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
        listFn={async () => [{ id: "1", display_name: "Existing" }]}
        createFn={createFn}
        updateFn={async () => ({})}
        deleteFn={deleteFn}
      />
    </QueryClientProvider>,
  );
}

describe("OperationsCrudPage submit feedback", () => {
  it("shows the pending label and disables the submit button while create is in flight", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const createFn = vi.fn(() => new Promise<unknown>((resolve) => { release = () => resolve({}); }));

    renderPage(createFn);

    await user.click(await screen.findByRole("button", { name: /new|create|add/i }));
    await user.type(await screen.findByLabelText(/display name/i), "Home Cleaning");
    const submit = screen.getByTestId("crud-submit");
    await user.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    expect(submit).toHaveTextContent(/saving/i);
    expect(createFn).toHaveBeenCalledTimes(1);

    release();
  });

  it("optimistically removes the row as soon as delete is confirmed", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const deleteFn = vi.fn(() => new Promise<unknown>((resolve) => { release = () => resolve({}); }));

    renderPage(async () => ({}), deleteFn);

    await screen.findByText("Existing");
    await user.click(await screen.findByRole("button", { name: /^delete$/i }));
    const confirm = await screen.findByRole("button", { name: /confirm delete/i });
    await user.click(confirm);

    // The row (and its dialog) is removed from the DOM immediately, before the
    // delete request resolves — this is the optimistic update taking effect.
    await waitFor(() => expect(screen.queryByText("Existing")).not.toBeInTheDocument());
    expect(deleteFn).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() => expect(screen.getByText(/no records found/i)).toBeInTheDocument());
  });

  it("restores the row if the delete request fails", async () => {
    const user = userEvent.setup();
    const deleteFn = vi.fn(() => Promise.reject(new Error("boom")));

    renderPage(async () => ({}), deleteFn);

    await screen.findByText("Existing");
    await user.click(await screen.findByRole("button", { name: /^delete$/i }));
    const confirm = await screen.findByRole("button", { name: /confirm delete/i });
    await user.click(confirm);

    // The request rejects fast enough that removal and rollback can both land
    // before we get to assert, so only the final, settled state is checked here.
    await waitFor(() => expect(screen.getByText("Existing")).toBeInTheDocument());
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });
});
