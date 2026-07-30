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

  /**
   * Regression: ADMIN_AUTH.md answers a wrong password and a wrong OTP/TOTP
   * code with 401 too. Reading those as session expiry cleared the hint and
   * signed the admin out on a single typo — and refreshed-and-replayed the
   * request first, recording a second failed attempt server-side.
   */
  describe.each([
    "INVALID_CREDENTIALS",
    "TOTP_INVALID",
    "OTP_INVALID",
    "OTP_EXPIRED",
    "OTP_LOCKED",
    "TEMP_PASSWORD_EXPIRED",
  ])("a 401 carrying the domain code %s", (code) => {
    it("keeps the auth hint, never refreshes and makes exactly one request", async () => {
      setAuthHint();

      const fetchMock = getFetchMock();
      // Nothing is queued for the refresh route: a second call would resolve to
      // `undefined` and throw, which is the loudest possible failure here.
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ success: false, message: "nope", data: { code, details: null }, requestId: "req_test" }, 401)
      );

      await expect(apiRequest("/v1/admins/2fa/verify", { method: "POST" })).rejects.toMatchObject({
        status: 401,
        code,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(hasAuthHint()).toBe(true);
    });
  });

  it("still clears the hint for a bare 401 that carries no domain code", async () => {
    setAuthHint();

    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false, message: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: false, message: "unauthorized" }, 401));

    await expect(apiRequest("/v1/admins/profile")).rejects.toMatchObject({ status: 401 });

    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/admins/refresh");
    expect(hasAuthHint()).toBe(false);
  });

  /**
   * Regression: 403 used to sit in the retry condition, so every forbidden
   * request was doubled and a failed refresh (a reuse-detected rotation) then
   * logged the admin out — contradicting "on 403 FORBIDDEN do NOT log out".
   */
  it("does not refresh, replay or clear the hint on a 403", async () => {
    setAuthHint();

    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, message: "forbidden", data: { code: "FORBIDDEN", details: null } }, 403)
    );

    await expect(apiRequest("/v1/admins/team")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hasAuthHint()).toBe(true);
  });

  it("does not refresh, replay or clear the hint on a 403 PASSWORD_CHANGE_REQUIRED", async () => {
    setAuthHint();

    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { success: false, message: "change your password", data: { code: "PASSWORD_CHANGE_REQUIRED", details: null } },
        403
      )
    );

    await expect(apiRequest("/v1/admins/profile")).rejects.toMatchObject({
      status: 403,
      code: "PASSWORD_CHANGE_REQUIRED",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hasAuthHint()).toBe(true);
  });

  it("still clears the hint on AUTH_ROLE_MISMATCH whatever the status", async () => {
    setAuthHint();

    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, message: "wrong role", data: { code: "AUTH_ROLE_MISMATCH", details: null } }, 403)
    );

    await expect(apiRequest("/v1/admins/profile")).rejects.toMatchObject({ code: "AUTH_ROLE_MISMATCH" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hasAuthHint()).toBe(false);
  });
});
