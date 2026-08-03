import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listFeatureTemplates, createFeatureTemplate, deleteFeatureTemplate } from "@/lib/api/admin-api";
import type { FeatureTemplate } from "@/lib/api/template-types";

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

function makeTemplate(id: string): FeatureTemplate {
  return {
    id,
    feature: "promo-codes",
    name: `Template ${id}`,
    description: undefined,
    payload: { code: "SAVE10" },
    dateCreated: null,
    lastUpdated: null,
  };
}

/**
 * The list endpoint (`crudRouter`'s generic GET) supports only `limit`/`skip`
 * pagination, has no server-side `feature` filter, and hard-caps `limit` at
 * 200 (`_generic-repo.ts:34`: `Math.min(Math.max(opts.limit ?? 50, 1), 200)`).
 * A bare/naive call therefore silently truncates the list a client-side
 * feature filter draws from. `listFeatureTemplates` must request `limit=200`
 * and keep paging with `skip` using the envelope's `total` until every
 * template has been fetched.
 */
describe("feature template API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listFeatureTemplates", () => {
    it("GETs the confirmed path with limit=200 on the first page", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [], total: 0 })));

      await listFeatureTemplates();

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/feature-templates?limit=200&skip=0");
    });

    it("pages with skip until it has fetched every template past a 200-item first page", async () => {
      const fetchMock = getFetchMock();
      const firstPage = Array.from({ length: 200 }, (_, i) => makeTemplate(`t${i}`));
      const secondPage = Array.from({ length: 50 }, (_, i) => makeTemplate(`t${200 + i}`));

      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: firstPage, total: 250 })));
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: secondPage, total: 250 })));

      const result = await listFeatureTemplates();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/feature-templates?limit=200&skip=0");
      expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/admins/feature-templates?limit=200&skip=200");
      expect(result).toHaveLength(250);
      expect(result.map((t) => t.id)).toEqual([...firstPage, ...secondPage].map((t) => t.id));
    });

    it("makes no second call when the first page already covers total", async () => {
      const fetchMock = getFetchMock();
      const page = Array.from({ length: 3 }, (_, i) => makeTemplate(`t${i}`));
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: page, total: 3 })));

      const result = await listFeatureTemplates();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(3);
    });

    it("throws rather than silently returning a partial list when total is unreachable", async () => {
      const fetchMock = getFetchMock();
      // Malformed envelope: no usable `total`.
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ items: [makeTemplate("t0")] })));

      await expect(listFeatureTemplates()).rejects.toThrow();
    });
  });

  describe("createFeatureTemplate", () => {
    it("POSTs the exact payload to the confirmed path", async () => {
      const fetchMock = getFetchMock();
      const created = makeTemplate("t1");
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope(created), 201));

      const payload = {
        feature: "promo-codes" as const,
        name: "Template t1",
        payload: { code: "SAVE10" },
      };
      const result = await createFeatureTemplate(payload);

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/feature-templates");
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual(payload);
      expect(result).toEqual(created);
    });
  });

  describe("deleteFeatureTemplate", () => {
    it("DELETEs the template by id", async () => {
      const fetchMock = getFetchMock();
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope({ ok: true })));

      await deleteFeatureTemplate("t1");

      expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/feature-templates/t1");
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe("DELETE");
    });
  });
});
