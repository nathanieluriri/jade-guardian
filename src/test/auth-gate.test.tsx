import { QueryCache, QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReplace, pathnameState } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  pathnameState: { current: "/admin/overview" },
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
  usePathname: () => pathnameState.current,
}));

/**
 * Same stub as `branded-splash.test.tsx`: the real dotLottie player drives a
 * wasm renderer jsdom can't execute, and several states below (loading,
 * mustChangePassword, no-hint) render `BrandedSplash`.
 */
vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: () => <div data-testid="dotlottie" />,
}));

import { handleAdminQueryError } from "@/app/providers";
import { AdminAuthGate } from "@/components/auth/AdminAuthGate";
import { hasAuthHint, setAuthHint } from "@/lib/api/auth-storage";

const PROFILE_URL = "/api/v1/admins/profile";

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

/** Routes `fetch` by URL; the last queued response for a path repeats for further calls. */
function stubRoutes(routes: Record<string, StubbedResponse[]>) {
  const queues = new Map(Object.entries(routes).map(([path, responses]) => [path, [...responses]]));
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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

function stubPendingProfile() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {}))
  );
}

function profileBody(overrides: Partial<Record<string, unknown>> = {}) {
  return envelope({
    id: "a1",
    email: "admin@example.com",
    accessPreset: null,
    mustChangePassword: false,
    totpEnabled: false,
    isSuperAdmin: false,
    permissionList: [],
    ...overrides,
  });
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderGate() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AdminAuthGate>
        <div data-testid="protected-content">Protected</div>
      </AdminAuthGate>
    </QueryClientProvider>
  );
}

describe("handleAdminQueryError", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockReplace.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces to /admin/change-password on a PASSWORD_CHANGE_REQUIRED error", () => {
    handleAdminQueryError(
      { status: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "x" },
      { replace: mockReplace },
      "/admin/overview"
    );

    expect(mockReplace).toHaveBeenCalledWith("/admin/change-password");
  });

  it("does not repeat the redirect when already on /admin/change-password (loop guard)", () => {
    handleAdminQueryError(
      { status: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "x" },
      { replace: mockReplace },
      "/admin/change-password"
    );

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not clear the auth hint or navigate away on a 403 FORBIDDEN error", () => {
    setAuthHint();

    handleAdminQueryError({ status: 403, code: "FORBIDDEN", message: "x" }, { replace: mockReplace }, "/admin/team");

    expect(hasAuthHint()).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("clears the auth hint and replaces to /admin/login on a 401 that survives refresh", () => {
    setAuthHint();

    handleAdminQueryError({ status: 401, message: "Session expired" }, { replace: mockReplace }, "/admin/overview");

    expect(hasAuthHint()).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/admin/login");
  });

  it("still clears the hint but does not repeat the redirect when already on /admin/login", () => {
    setAuthHint();

    handleAdminQueryError({ status: 401, message: "Session expired" }, { replace: mockReplace }, "/admin/login");

    expect(hasAuthHint()).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does nothing for an unrelated server error", () => {
    setAuthHint();

    handleAdminQueryError({ status: 500, message: "boom" }, { replace: mockReplace }, "/admin/overview");

    expect(mockReplace).not.toHaveBeenCalled();
    expect(hasAuthHint()).toBe(true);
  });

  it("ignores values that aren't shaped like an ApiError", () => {
    setAuthHint();

    handleAdminQueryError(new Error("boom"), { replace: mockReplace }, "/admin/overview");
    handleAdminQueryError(null, { replace: mockReplace }, "/admin/overview");
    handleAdminQueryError("nope", { replace: mockReplace }, "/admin/overview");

    expect(mockReplace).not.toHaveBeenCalled();
    expect(hasAuthHint()).toBe(true);
  });
});

describe("QueryClient error interception (integration)", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("intercepts a PASSWORD_CHANGE_REQUIRED error surfaced through the QueryCache and redirects", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
      queryCache: new QueryCache({
        onError: (error) => handleAdminQueryError(error, { replace: mockReplace }, "/admin/overview"),
      }),
    });

    function Probe() {
      useQuery({
        queryKey: ["probe"],
        queryFn: () => Promise.reject({ status: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "x" }),
      });
      return null;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/change-password"));
  });
});

describe("AdminAuthGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockReplace.mockClear();
    pathnameState.current = "/admin/overview";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to /admin/login when the browser holds no auth hint", async () => {
    stubRoutes({});
    renderGate();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("renders the branded splash, not children, while the profile is first loading", async () => {
    setAuthHint();
    stubPendingProfile();

    renderGate();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    // Settle the mocked player import so no update lands after the test ends.
    await screen.findByTestId("dotlottie");
  });

  it("redirects a locked (mustChangePassword) admin to change-password before any route-permission check", async () => {
    // /admin/overview requires several monitoring permissions this profile
    // doesn't have — proving the mustChangePassword redirect fires
    // regardless of whether the route itself would otherwise be allowed.
    setAuthHint();
    stubRoutes({
      [PROFILE_URL]: [{ body: profileBody({ mustChangePassword: true }) }],
    });

    renderGate();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/change-password"));
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permission-denied")).not.toBeInTheDocument();
  });

  it("renders PermissionDenied instead of silently redirecting when the current route is disallowed", async () => {
    pathnameState.current = "/admin/team"; // requires GET /v1/admins
    setAuthHint();
    stubRoutes({
      [PROFILE_URL]: [{ body: profileBody() }],
    });

    renderGate();

    await screen.findByTestId("permission-denied");
    expect(screen.getByText("GET /v1/admins")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to available area" })).toHaveAttribute("href", "/admin/access");
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    // No silent bounce to some other allowed route.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children once an allowed, unlocked profile resolves", async () => {
    pathnameState.current = "/admin/access"; // always-allowed hub
    setAuthHint();
    stubRoutes({
      [PROFILE_URL]: [{ body: profileBody() }],
    });

    renderGate();

    await screen.findByTestId("protected-content");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("permission-denied")).not.toBeInTheDocument();
  });

  it("holds the splash rather than flashing children when the profile fetch fails", async () => {
    setAuthHint();
    stubRoutes({
      [PROFILE_URL]: [
        { body: { success: false, message: "boom", data: { code: "INTERNAL_ERROR", details: null } }, status: 500 },
      ],
    });

    renderGate();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});
