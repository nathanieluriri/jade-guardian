import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createAdminQueryClient, Providers } from "@/app/providers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/overview",
}));

describe("admin query defaults", () => {
  it("keeps data fresh long enough that revisiting a page does not refetch", () => {
    const defaults = createAdminQueryClient().getDefaultOptions().queries;

    expect(defaults?.staleTime).toBeGreaterThanOrEqual(30_000);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
    expect(defaults?.retry).toBe(1);
  });

  it("keeps unmounted page data cached for longer than it stays fresh", () => {
    const defaults = createAdminQueryClient().getDefaultOptions().queries;

    expect(defaults?.gcTime).toBeGreaterThan(defaults?.staleTime as number);
  });

  /**
   * Regression guard for the two tests above: they exercise
   * `createAdminQueryClient()` directly, which proves the factory's defaults
   * are correct but not that the app actually wires that factory into the
   * `QueryClient` it renders with. `Providers` builds its client via
   * `useState(() => createAdminQueryClient(...))`, so mounting it for real
   * and reading the client back out through `useQueryClient()` closes that
   * gap.
   */
  it("mounts the app-wide QueryClient (via Providers) with the same staleTime the factory sets", () => {
    function Probe() {
      const staleTime = useQueryClient().getDefaultOptions().queries?.staleTime;
      return <div data-testid="stale-time">{String(staleTime)}</div>;
    }

    render(
      <Providers initialTheme="light">
        <Probe />
      </Providers>
    );

    expect(screen.getByTestId("stale-time")).toHaveTextContent("60000");
  });
});
