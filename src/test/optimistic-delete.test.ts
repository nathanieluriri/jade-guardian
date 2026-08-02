import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { optimisticDeleteHandlers } from "@/features/admin/screens/operations/optimistic-delete";
import type { AdminResourceItem } from "@/lib/api/types";

const ITEMS: AdminResourceItem[] = [
  { id: "1", display_name: "Home Cleaning" },
  { id: "2", display_name: "Deep Cleaning" },
];

/** Key shape mirrors OperationsCrudPage.tsx:154 — ["operations", queryKey]. */
const KEY = ["operations", "service-definitions"];

function seededClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(KEY, ITEMS);
  return client;
}

describe("optimisticDeleteHandlers", () => {
  it("removes the row from cache before the request resolves", async () => {
    const client = seededClient();
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    await handlers.onMutate("1");

    const cached = client.getQueryData<AdminResourceItem[]>(KEY);
    expect(cached).toHaveLength(1);
    expect(cached?.[0].id).toBe("2");
  });

  it("returns the pre-delete list so a failure can roll back", async () => {
    const client = seededClient();
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    const context = await handlers.onMutate("1");

    expect(context.previous).toHaveLength(2);
  });

  it("restores the removed row when the request fails", async () => {
    const client = seededClient();
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    const context = await handlers.onMutate("1");
    handlers.onError(new Error("boom"), "1", context);

    const cached = client.getQueryData<AdminResourceItem[]>(KEY);
    expect(cached).toHaveLength(2);
    expect(cached?.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("leaves the cache untouched when the id matches nothing", async () => {
    const client = seededClient();
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    await handlers.onMutate("does-not-exist");

    expect(client.getQueryData<AdminResourceItem[]>(KEY)).toHaveLength(2);
  });

  it("tolerates an unseeded cache without throwing", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    const context = await handlers.onMutate("1");

    expect(context.previous).toBeUndefined();
    expect(client.getQueryData(KEY)).toEqual([]);
  });
});
