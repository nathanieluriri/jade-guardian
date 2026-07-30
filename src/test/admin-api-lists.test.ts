import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAlerts,
  listAdminCustomerPlaces,
  listAdmins,
  listAuditHistory,
  listCleaners,
  listCustomers,
  listElevationRequests,
  listOnboardingQueue,
  listServiceDefinitions,
} from "@/lib/api/admin-api";

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

/**
 * Two things these tests pin down for every paginating `admin-api.ts` list function:
 *
 * 1. The real backend wraps list responses in the shared `GenericList` schema
 *    (`{ items, total }` — see `app/server/schemas/admin-core.ts` in the backend repo),
 *    never a bare array, so these functions must unwrap that envelope internally so
 *    callers can keep calling `.map()` / `.filter()` directly on the result (see
 *    UsersPage.tsx, AccessRequestsPage.tsx, AlertsPage.tsx, CleanerOnboardingPage.tsx,
 *    EmployeesPage.tsx, TeamPage.tsx).
 * 2. The backend's shared `AdminListQuery` schema only accepts `limit`/`skip` (+`search`)
 *    — never `start`/`stop`. Every outgoing request below is asserted against the exact
 *    query string the backend actually understands.
 */
describe("admin-api list query params", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listCustomers", () => {
    it("unwraps { items, total } to a plain array and defaults to limit/skip", async () => {
      const fetchMock = getFetchMock();
      const items = [
        { id: "c1", email: "a@example.com" },
        { id: "c2", email: "b@example.com" },
      ];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 2 })));

      const result = await listCustomers();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/customers?limit=100&skip=0");
    });

    it("forwards search when provided", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], total: 0 })));

      await listCustomers({ limit: 25, skip: 50, search: "jane" });

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/customers?limit=25&skip=50&search=jane");
    });

    it("returns [] when the items field is missing", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ total: 0 })));

      const result = await listCustomers();

      expect(result).toEqual([]);
    });
  });

  describe("listCleaners", () => {
    it("unwraps { items, total } to a plain array and defaults to limit/skip", async () => {
      const fetchMock = getFetchMock();
      const items = [{ id: "cl1", email: "cleaner@example.com" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listCleaners();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/cleaners?limit=100&skip=0");
    });

    it("forwards search when provided", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], total: 0 })));

      await listCleaners({ search: "maria" });

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/cleaners?limit=100&skip=0&search=maria");
    });

    it("returns [] for an empty items array", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], total: 0 })));

      const result = await listCleaners();

      expect(result).toEqual([]);
    });
  });

  describe("listOnboardingQueue", () => {
    it("unwraps { items, total } to a plain array and defaults to limit/skip (no dead sort param)", async () => {
      const fetchMock = getFetchMock();
      const items = [{ id: "cl2", email: "onboarding@example.com" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listOnboardingQueue();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/onboarding/queue?limit=50&skip=0");
    });

    it("forwards search when provided", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], total: 0 })));

      await listOnboardingQueue({ search: "smith" });

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/onboarding/queue?limit=50&skip=0&search=smith");
    });

    it("returns [] when the envelope has no items field at all", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({})));

      const result = await listOnboardingQueue();

      expect(result).toEqual([]);
    });
  });

  describe("listElevationRequests", () => {
    it("unwraps { items, total } to a plain array and defaults to limit/skip", async () => {
      const fetchMock = getFetchMock();
      const items = [{ requestId: "req1", adminId: "admin1", status: "PENDING" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listElevationRequests();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/access/requests?limit=50&skip=0");
    });

    it("keeps status alongside limit/skip", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], total: 0 })));

      await listElevationRequests({ status: "PENDING", skip: 20, limit: 10 });

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/access/requests?status=PENDING&limit=10&skip=20");
    });

    it("returns [] when the items field is missing", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ total: 0 })));

      const result = await listElevationRequests();

      expect(result).toEqual([]);
    });
  });

  describe("listAdminCustomerPlaces", () => {
    it("unwraps { items, total } to a plain array instead of always returning [] and defaults to limit/skip", async () => {
      const fetchMock = getFetchMock();
      const items = [{ place_id: "p1", label: "Home" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listAdminCustomerPlaces("cust_1");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe(
        "/api/v1/admins/customers/cust_1/places?limit=20&skip=0"
      );
    });

    it("returns [] for an empty items array", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], total: 0 })));

      const result = await listAdminCustomerPlaces("cust_1");

      expect(result).toEqual([]);
    });
  });

  describe("fetchAlerts", () => {
    it("unwraps { items, total } to a plain array and defaults to limit/skip", async () => {
      const fetchMock = getFetchMock();
      const items = [{ _id: "a1", rule_key: "r1", severity: "critical" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await fetchAlerts({});

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/monitoring/alerts?limit=20&skip=0");
    });

    it("returns [] when the items field is missing from the envelope", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ total: 0 })));

      const result = await fetchAlerts({});

      expect(result).toEqual([]);
    });
  });

  describe("listAdmins", () => {
    it("hits /api/v1/admins with no trailing slash and limit/skip params", async () => {
      const fetchMock = getFetchMock();
      const items = [{ id: "admin1", email: "admin@example.com" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listAdmins();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins?limit=100&skip=0");
    });

    it("respects explicit limit/skip", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], total: 0 })));

      await listAdmins({ limit: 10, skip: 30 });

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins?limit=10&skip=30");
    });

    it("returns [] when the items field is missing (also unwraps the GenericList envelope, not just a bare array)", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ total: 0 })));

      const result = await listAdmins();

      expect(result).toEqual([]);
    });
  });

  describe("listAuditHistory", () => {
    it("sends its start/stop pagination fields on the wire as skip/limit", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], query: {}, pagination: {} })));

      await listAuditHistory({});

      expect(fetchMock.mock.calls[0][0]).toBe(
        "/api/v1/admins/monitoring/audit/history?sort=desc&skip=0&limit=20"
      );
    });

    it("maps explicit start/stop to skip/limit and leaves other filters untouched", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], query: {}, pagination: {} })));

      await listAuditHistory({ start: 40, stop: 10, actor_id: "admin_1" });

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("skip=40");
      expect(url).toContain("limit=10");
      expect(url).toContain("actor_id=admin_1");
      expect(url).not.toContain("start=");
      expect(url).not.toContain("stop=");
    });
  });

  describe("listServiceDefinitions (representative of the listAdminResource-backed CRUD list functions)", () => {
    it("uses limit/skip instead of start/stop", async () => {
      const fetchMock = getFetchMock();
      const items = [{ id: "svc1", name: "Deep Clean" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listServiceDefinitions();

      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/service-definitions/?limit=100&skip=0");
    });
  });
});
