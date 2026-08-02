import { describe, expect, it } from "vitest";
import { createAdminQueryClient } from "@/app/providers";

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
});
