import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/access",
}));

import { CommandBar } from "@/components/CommandBar";
import { SECURITY_SETTINGS_ROUTE } from "@/lib/admin-access";
import { setAuthHint } from "@/lib/api/auth-storage";

const PROFILE_URL = "/api/v1/admins/profile";

/**
 * A permission-limited profile: the alerts and elevation-request queries are
 * both `enabled`-gated on route access, so nothing but the profile is ever
 * fetched here.
 */
function stubLimitedProfile() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) !== PROFILE_URL) throw new Error(`Unstubbed request: ${String(input)}`);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: "ok",
          data: {
            id: "a1",
            email: "admin@example.com",
            accessPreset: "support_only",
            mustChangePassword: false,
            totpEnabled: true,
            isSuperAdmin: false,
            permissionList: ["GET:/api/v1/faq"],
          },
        }),
      } as unknown as Response;
    })
  );
}

async function openPalette() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <CommandBar />
    </QueryClientProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: /search alerts/i }));
  return screen.findByRole("dialog");
}

describe("CommandBar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockClear();
    setAuthHint();
    stubLimitedProfile();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Regression: Account Security is self-service, so it is always in
   * `allowedRoutes` and the sidebar always shows it — but it was missing from
   * the palette's own list, which is the only way to reach it by keyboard.
   */
  it("offers Account Security in Quick Navigation for a permission-limited admin", async () => {
    await openPalette();

    const item = await screen.findByRole("option", { name: /Account Security/i });
    fireEvent.click(item);

    expect(mockPush).toHaveBeenCalledWith(SECURITY_SETTINGS_ROUTE);
  });

  it("still hides the routes that admin has no permission for", async () => {
    await openPalette();

    expect(await screen.findByRole("option", { name: /Account Security/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Users/i })).not.toBeInTheDocument();
  });
});
