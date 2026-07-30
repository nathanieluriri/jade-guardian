import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReplace, mockToastSuccess } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/change-password",
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: vi.fn(), message: vi.fn() },
}));

import { ChangePasswordScreen } from "@/features/auth/components/change-password-screen";
import { setAuthHint } from "@/lib/api/auth-storage";

const CHANGE_URL = "/api/v1/admins/change-password";
const PROFILE_URL = "/api/v1/admins/profile";
const REFRESH_URL = "/api/v1/admins/refresh";

type StubbedResponse = { body: unknown; status?: number };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function envelope(data: unknown) {
  return { success: true, message: "ok", data };
}

function stubRoutes(routes: Record<string, StubbedResponse[]>) {
  const queues = new Map(Object.entries(routes).map(([path, responses]) => [path, [...responses]]));
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const path = String(input);
    const queue = queues.get(path);
    if (!queue || queue.length === 0) {
      throw new Error(`Unstubbed request: ${path}`);
    }
    const next = queue.length > 1 ? (queue.shift() as StubbedResponse) : queue[0];
    return jsonResponse(next.body, next.status ?? 200);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const SUPER_ADMIN_PROFILE: StubbedResponse = {
  body: envelope({
    id: "a1",
    email: "admin@example.com",
    accessPreset: null,
    mustChangePassword: true,
    totpEnabled: false,
    isSuperAdmin: true,
  }),
};

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChangePasswordScreen />
    </QueryClientProvider>
  );
}

function fillForm({ current, next, confirm }: { current: string; next: string; confirm: string }) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
}

function calledPaths(fetchMock: ReturnType<typeof stubRoutes>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

describe("admin change-password screen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setAuthHint();
    mockReplace.mockClear();
    mockToastSuccess.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks submission while the new password and confirmation differ", async () => {
    const fetchMock = stubRoutes({ [PROFILE_URL]: [SUPER_ADMIN_PROFILE] });
    renderScreen();

    fillForm({ current: "TempPass-123", next: "a-brand-new-password", confirm: "a-brand-new-passwordX" });

    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Update password" });
    expect(submit).toBeDisabled();

    await act(async () => {
      fireEvent.click(submit);
    });

    expect(calledPaths(fetchMock)).not.toContain(CHANGE_URL);
  });

  it("blocks submission below the 8-character minimum", async () => {
    const fetchMock = stubRoutes({ [PROFILE_URL]: [SUPER_ADMIN_PROFILE] });
    renderScreen();

    fillForm({ current: "TempPass-123", next: "short", confirm: "short" });

    expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update password" })).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    });

    expect(calledPaths(fetchMock)).not.toContain(CHANGE_URL);
  });

  it("posts both fields, toasts, and redirects to the first allowed route on success", async () => {
    const fetchMock = stubRoutes({
      [CHANGE_URL]: [{ body: envelope({ ok: true }) }],
      [PROFILE_URL]: [SUPER_ADMIN_PROFILE],
    });
    renderScreen();

    fillForm({ current: "TempPass-123", next: "a-brand-new-password", confirm: "a-brand-new-password" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    });

    const changeCall = fetchMock.mock.calls.find((call) => String(call[0]) === CHANGE_URL);
    expect(changeCall).toBeDefined();
    expect(JSON.parse(String(changeCall?.[1]?.body ?? "{}"))).toEqual({
      currentPassword: "TempPass-123",
      newPassword: "a-brand-new-password",
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/overview"));
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("still reports success and redirects when the post-success profile refetch fails", async () => {
    // The mutation itself (POST /change-password) succeeds once; every profile GET issued
    // after it fails (a 500 stands in for a transient failure). Pins the useChangePassword
    // fix: the follow-up refetch is isolated in its own try/catch so its failure can never
    // surface as a submission failure for an already-irreversible password change.
    stubRoutes({
      [CHANGE_URL]: [{ body: envelope({ ok: true }) }],
      [PROFILE_URL]: [
        SUPER_ADMIN_PROFILE,
        {
          body: { success: false, message: "Server error", data: { code: "INTERNAL_ERROR", details: null } },
          status: 500,
        },
      ],
    });
    renderScreen();

    // Wait for the initial profile load to land in the cache before submitting, so a
    // stale-but-valid profile exists for the redirect target once the post-mutation
    // refetch starts failing.
    await waitFor(() => expect(screen.getByText("admin@example.com")).toBeInTheDocument());

    fillForm({ current: "TempPass-123", next: "a-brand-new-password", confirm: "a-brand-new-password" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/overview"));
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("maps a wrong current password to current-password copy, not the login email/password copy", async () => {
    // The real backend (`admin-service.ts`'s `changePassword`) throws the exact same
    // `INVALID_CREDENTIALS` / "Invalid email or password" that `login` throws for a bad
    // password — see ADMIN_AUTH.md's error table ("Wrong email/password (or wrong current
    // password)"). This screen has no email field, so the generic login copy would be a
    // non-sequitur here; `adminAuthErrorCopy(error, "change-password")` must remap it.
    //
    // The 401 status is realistic (matches the backend exactly) but also means the api
    // client's generic refresh-and-retry interceptor (`client.ts`'s `apiRequest`, which
    // can't distinguish "session expired" from "wrong password, session still fine") fires
    // first: it refreshes (the admin's session is otherwise valid) and retries the change
    // request once, which fails the same way. Both the refresh endpoint and a second
    // CHANGE_URL hit need stubs; CHANGE_URL's single queued entry is sticky, so it already
    // answers the retry with the same error.
    stubRoutes({
      [CHANGE_URL]: [
        {
          body: {
            success: false,
            message: "Invalid email or password",
            data: { code: "INVALID_CREDENTIALS", details: null },
          },
          status: 401,
        },
      ],
      [PROFILE_URL]: [SUPER_ADMIN_PROFILE],
      [REFRESH_URL]: [{ body: envelope({}) }],
    });
    renderScreen();

    fillForm({ current: "wrong-temp-pass", next: "a-brand-new-password", confirm: "a-brand-new-password" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("That current password isn't right.")
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
