import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { hasAuthHint, setAuthHint } from "@/lib/api/auth-storage";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function getFetchMock(): FetchMock {
  return global.fetch as unknown as FetchMock;
}

describe("apiRequest", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends credentials and no Authorization header", async () => {
    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: "ok", data: { id: "1" } }));

    await apiRequest("/v1/admins/profile");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe("include");
    const headers = new Headers(init.headers);
    expect(headers.has("authorization")).toBe(false);
  });

  it("uses a relative /api path so cookies are first-party", async () => {
    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: "ok", data: { id: "1" } }));

    await apiRequest("/v1/admins/profile");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/admins/profile");
  });

  it("refreshes once on 401 then replays the request", async () => {
    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false, message: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "ok", data: null }, 200))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "ok", data: { id: "1" } }, 200));

    const result = await apiRequest<{ id: string }>("/v1/admins/profile");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/admins/refresh");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "include" });
    expect(fetchMock.mock.calls[2][0]).toBe("/api/v1/admins/profile");
    expect(result.data).toEqual({ id: "1" });
  });

  it("clears the auth hint when refresh fails", async () => {
    setAuthHint();
    expect(hasAuthHint()).toBe(true);

    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ success: false, message: "unauthorized", data: { code: "AUTH_INVALID", details: null }, requestId: "req_test" }, 401)
      )
      .mockResolvedValueOnce(jsonResponse({ success: false, message: "unauthorized" }, 401));

    await expect(apiRequest("/v1/admins/profile")).rejects.toMatchObject({ status: 401 });
    expect(hasAuthHint()).toBe(false);
  });
});
