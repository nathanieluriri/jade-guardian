import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { prefetchNavItem } from "@/components/AdminSidebar";

describe("prefetchNavItem", () => {
  it("populates the cache for an item that declares a prefetch", async () => {
    const client = new QueryClient();
    const queryFn = vi.fn().mockResolvedValue({ ok: true });

    await prefetchNavItem(client, { prefetch: { queryKey: ["service-definitions"], queryFn } });

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["service-definitions"])).toEqual({ ok: true });
  });

  it("is a no-op for an item with no prefetch declared", async () => {
    const client = new QueryClient();

    await expect(prefetchNavItem(client, {})).resolves.toBeUndefined();
  });

  it("does not refetch data that is already fresh", async () => {
    const client = new QueryClient();
    const queryFn = vi.fn().mockResolvedValue({ ok: true });
    client.setQueryData(["service-definitions"], { ok: true });

    await prefetchNavItem(client, { prefetch: { queryKey: ["service-definitions"], queryFn } });

    expect(queryFn).not.toHaveBeenCalled();
  });
});
