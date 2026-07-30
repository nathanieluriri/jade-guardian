import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAlerts,
  listAdminCustomerPlaces,
  listCleaners,
  listCustomers,
  listElevationRequests,
  listOnboardingQueue,
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
 * The real backend wraps every list response in the shared `GenericList` schema
 * (`{ items, total }` — see `app/server/schemas/admin-core.ts` in the backend repo),
 * never a bare array. These six `admin-api.ts` functions must unwrap that envelope
 * internally so callers can keep calling `.map()` / `.filter()` directly on the
 * result (see UsersPage.tsx, AccessRequestsPage.tsx, AlertsPage.tsx,
 * CleanerOnboardingPage.tsx, EmployeesPage.tsx).
 */
describe("admin-api list unwrapping", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listCustomers", () => {
    it("unwraps { items, total } to a plain array", async () => {
      const fetchMock = getFetchMock();
      const items = [
        { id: "c1", email: "a@example.com" },
        { id: "c2", email: "b@example.com" },
      ];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 2 })));

      const result = await listCustomers();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/customers?start=0&stop=100");
    });

    it("returns [] when the items field is missing", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ total: 0 })));

      const result = await listCustomers();

      expect(result).toEqual([]);
    });
  });

  describe("listCleaners", () => {
    it("unwraps { items, total } to a plain array", async () => {
      const fetchMock = getFetchMock();
      const items = [{ id: "cl1", email: "cleaner@example.com" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listCleaners();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/cleaners?start=0&stop=100");
    });

    it("returns [] for an empty items array", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], total: 0 })));

      const result = await listCleaners();

      expect(result).toEqual([]);
    });
  });

  describe("listOnboardingQueue", () => {
    it("unwraps { items, total } to a plain array", async () => {
      const fetchMock = getFetchMock();
      const items = [{ id: "cl2", email: "onboarding@example.com" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listOnboardingQueue();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe(
        "/api/v1/admins/onboarding/queue?start=0&stop=50&sort=submitted_at"
      );
    });

    it("returns [] when the envelope has no items field at all", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({})));

      const result = await listOnboardingQueue();

      expect(result).toEqual([]);
    });
  });

  describe("listElevationRequests", () => {
    it("unwraps { items, total } to a plain array", async () => {
      const fetchMock = getFetchMock();
      const items = [{ requestId: "req1", adminId: "admin1", status: "PENDING" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listElevationRequests();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/access/requests?start=0&stop=50");
    });

    it("returns [] when the items field is missing", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ total: 0 })));

      const result = await listElevationRequests();

      expect(result).toEqual([]);
    });
  });

  describe("listAdminCustomerPlaces", () => {
    it("unwraps { items, total } to a plain array instead of always returning []", async () => {
      const fetchMock = getFetchMock();
      const items = [{ place_id: "p1", label: "Home" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await listAdminCustomerPlaces("cust_1");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe(
        "/api/v1/admins/customers/cust_1/places?start=0&stop=20"
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
    it("unwraps { items, total } to a plain array", async () => {
      const fetchMock = getFetchMock();
      const items = [{ _id: "a1", rule_key: "r1", severity: "critical" }];
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items, total: 1 })));

      const result = await fetchAlerts({});

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(items);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/monitoring/alerts?start=0&stop=20");
    });

    it("returns [] when the items field is missing from the envelope", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ total: 0 })));

      const result = await fetchAlerts({});

      expect(result).toEqual([]);
    });
  });
});
