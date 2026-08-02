import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchNotificationTypes,
  previewBroadcastAudience,
  createBroadcast_v2,
  listNotificationBroadcasts,
  fetchNotificationBroadcast,
  resumeBroadcast,
  cancelBroadcast,
} from "@/lib/api/admin-api";
import type { BroadcastAudience, BroadcastCreateRequest, BroadcastOut } from "@/lib/api/broadcast-types";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Mirrors the backend's standard `{ success, message, data, requestId }` envelope. */
function envelope(data: unknown) {
  return { success: true, message: "ok", data, requestId: "req_test" };
}

function getFetchMock(): FetchMock {
  return global.fetch as unknown as FetchMock;
}

const broadcast: BroadcastOut = {
  id: "b1",
  title: "Hello",
  body: "World",
  type: "promo.broadcast",
  audience: { type: "ALL" },
  status: "SENT",
  promoId: null,
  promoCode: null,
  data: null,
  recipientCount: 10,
  processedCount: 10,
  sentCount: 10,
  failedCount: 0,
  createdBy: null,
  dispatchedAt: null,
  completedAt: null,
  dateCreated: null,
  lastUpdated: null,
};

/**
 * Unlike every other admin list, `/v1/admins/notifications/broadcasts` is
 * cursor-paginated: `cursor`/`pageSize` in, `{ items, nextCursor, pageSize }`
 * out. These tests pin that contract down explicitly since `listAdminResource`
 * and the flattening the other list functions do would both silently break it.
 */
describe("notification broadcast API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listNotificationBroadcasts", () => {
    it("sends pageSize/cursor and never limit/skip", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], nextCursor: null, pageSize: 20 })));

      await listNotificationBroadcasts({ cursor: "abc", pageSize: 20 });

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toBe("/api/v1/admins/notifications/broadcasts?cursor=abc&pageSize=20");
      expect(url).not.toMatch(/limit=/);
      expect(url).not.toMatch(/skip=/);
    });

    it("omits absent params", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], nextCursor: null, pageSize: 20 })));

      await listNotificationBroadcasts();

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/notifications/broadcasts");
    });

    it("returns { items, nextCursor, pageSize } intact, not flattened to an array", async () => {
      const fetchMock = getFetchMock();
      const body = { items: [broadcast], nextCursor: "next-page-cursor", pageSize: 20 };
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope(body)));

      const result = await listNotificationBroadcasts({ pageSize: 20 });

      expect(result).toEqual(body);
      expect(result.nextCursor).toBe("next-page-cursor");
    });
  });

  describe("fetchNotificationTypes", () => {
    it("GETs the types endpoint", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope(["promo.broadcast", "system.alert"])));

      const result = await fetchNotificationTypes();

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/notifications/types");
      expect(result).toEqual(["promo.broadcast", "system.alert"]);
    });
  });

  describe("previewBroadcastAudience", () => {
    it("POSTs the audience object as the body", async () => {
      const fetchMock = getFetchMock();
      const preview = {
        audience: { type: "ALL" as const },
        total: 5,
        customers: 3,
        cleaners: 2,
        reachableByPush: 4,
        matchedBeforeOptOut: 5,
        suppressedByOptOut: 0,
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope(preview)));

      const audience: BroadcastAudience = { type: "ALL" };
      const result = await previewBroadcastAudience(audience);

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/notifications/broadcasts/preview");
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual(audience);
      expect(result).toEqual(preview);
    });

    it("sends type as a query param when provided", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          envelope({
            audience: { type: "ALL" },
            total: 1,
            customers: 1,
            cleaners: 0,
            reachableByPush: 1,
            matchedBeforeOptOut: 1,
            suppressedByOptOut: 0,
          })
        )
      );

      const audience: BroadcastAudience = { type: "ALL" };
      await previewBroadcastAudience(audience, "system.alert");

      expect(fetchMock.mock.calls[0][0]).toBe(
        "/api/v1/admins/notifications/broadcasts/preview?type=system.alert"
      );
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual(audience);
    });

    it("sends no type param when omitted, letting the server default", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          envelope({
            audience: { type: "ALL" },
            total: 1,
            customers: 1,
            cleaners: 0,
            reachableByPush: 1,
            matchedBeforeOptOut: 1,
            suppressedByOptOut: 0,
          })
        )
      );

      const audience: BroadcastAudience = { type: "ALL" };
      await previewBroadcastAudience(audience);

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/notifications/broadcasts/preview");
      expect(fetchMock.mock.calls[0][0]).not.toMatch(/type=/);
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual(audience);
    });
  });

  describe("createBroadcast_v2", () => {
    it("POSTs to the notifications broadcast path, not the legacy /broadcasts path", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope(broadcast), 201));

      const payload: BroadcastCreateRequest = {
        title: "Hello",
        body: "World",
        audience: { type: "ALL" },
      };
      const result = await createBroadcast_v2(payload);

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/notifications/broadcasts");
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual(payload);
      expect(result).toEqual(broadcast);
    });
  });

  describe("fetchNotificationBroadcast", () => {
    it("GETs a single broadcast by id", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope(broadcast)));

      const result = await fetchNotificationBroadcast("b1");

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/notifications/broadcasts/b1");
      expect(result).toEqual(broadcast);
    });
  });

  describe("resumeBroadcast", () => {
    it("POSTs to the resume sub-path", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope(broadcast)));

      const result = await resumeBroadcast("b1");

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/notifications/broadcasts/b1/resume");
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe("POST");
      expect(result).toEqual(broadcast);
    });
  });

  describe("cancelBroadcast", () => {
    it("POSTs to the cancel sub-path", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope(broadcast)));

      const result = await cancelBroadcast("b1");

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/notifications/broadcasts/b1/cancel");
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe("POST");
      expect(result).toEqual(broadcast);
    });
  });
});
