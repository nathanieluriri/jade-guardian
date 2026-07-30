import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { useAdminLoginFlow, useAdminLogout, useChangePassword } from "@/hooks/use-admin-auth";
import { hasAuthHint, setAuthHint } from "@/lib/api/auth-storage";
import { adminAuthErrorCopy } from "@/lib/api/auth-errors";

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

/**
 * Real envelope shape for an error response: `{success, message, data, requestId}`
 * with the error code nested at `data.code` (never top-level) — see the Global
 * Constraints in the phase plan and `parseError` in `client.ts`. Mocks that put
 * `code` at the top level would still pass through `parseError`'s first
 * (wrong) branch and mask a regression in the `data.code` fallback it's
 * actually meant to exercise.
 */
function errorEnvelope(message: string, code: string, requestId = "req_test") {
  return { success: false, message, data: { code, details: null }, requestId };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

const otpChallengeResponse = jsonResponse({
  success: true,
  message: "ok",
  data: { otpRequired: true, otpChallengeId: "chal_1", method: "email" },
});

function profileResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return jsonResponse({
    success: true,
    message: "ok",
    data: {
      id: "a1",
      accessPreset: null,
      mustChangePassword: false,
      totpEnabled: false,
      isSuperAdmin: true,
      ...overrides,
    },
  });
}

describe("useAdminLoginFlow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
    mockReplace.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("moves credentials submission to the otp step, exposing challengeId and method", async () => {
    const { wrapper } = createWrapper();
    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValueOnce(otpChallengeResponse);

    const { result } = renderHook(() => useAdminLoginFlow(), { wrapper });

    await act(async () => {
      await result.current.submitCredentials({ email: "admin@example.com", password: "pw" });
    });

    expect(result.current.step).toEqual({
      kind: "otp",
      challengeId: "chal_1",
      method: "email",
      email: "admin@example.com",
    });
    expect(hasAuthHint()).toBe(false);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/login");
  });

  it("keeps the otp step and shows the mapped copy on a wrong code", async () => {
    const { wrapper } = createWrapper();
    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(otpChallengeResponse)
      .mockResolvedValueOnce(jsonResponse(errorEnvelope("Invalid code", "OTP_INVALID"), 401));

    const { result } = renderHook(() => useAdminLoginFlow(), { wrapper });

    await act(async () => {
      await result.current.submitCredentials({ email: "admin@example.com", password: "pw" });
    });
    await act(async () => {
      await result.current.submitOtp("000000");
    });

    expect(result.current.step.kind).toBe("otp");
    expect(result.current.error).toBe("That code isn't right. Check and try again.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/admins/verify-otp");
  });

  it("returns to the credentials step with lockout copy on OTP_LOCKED", async () => {
    const { wrapper } = createWrapper();
    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(otpChallengeResponse)
      .mockResolvedValueOnce(jsonResponse(errorEnvelope("Locked", "OTP_LOCKED"), 429));

    const { result } = renderHook(() => useAdminLoginFlow(), { wrapper });

    await act(async () => {
      await result.current.submitCredentials({ email: "admin@example.com", password: "pw" });
    });
    await act(async () => {
      await result.current.submitOtp("111111");
    });

    expect(result.current.step).toEqual({ kind: "credentials" });
    expect(result.current.error).toBe("Too many incorrect codes. Start again to get a new one.");
  });

  it("sets the auth hint and redirects to the first allowed route on successful verify", async () => {
    const { wrapper } = createWrapper();
    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(otpChallengeResponse)
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "ok", data: { admin: { id: "a1" }, tokens: null } }))
      .mockResolvedValueOnce(profileResponse({ mustChangePassword: false }));

    const { result } = renderHook(() => useAdminLoginFlow(), { wrapper });

    await act(async () => {
      await result.current.submitCredentials({ email: "admin@example.com", password: "pw" });
    });
    await act(async () => {
      await result.current.submitOtp("123456");
    });

    expect(hasAuthHint()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith("/admin/overview");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/v1/admins/profile");
  });

  it("redirects to /admin/change-password when the fetched profile requires it", async () => {
    const { wrapper } = createWrapper();
    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(otpChallengeResponse)
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "ok", data: { admin: { id: "a1" }, tokens: null } }))
      .mockResolvedValueOnce(profileResponse({ mustChangePassword: true }));

    const { result } = renderHook(() => useAdminLoginFlow(), { wrapper });

    await act(async () => {
      await result.current.submitCredentials({ email: "admin@example.com", password: "pw" });
    });
    await act(async () => {
      await result.current.submitOtp("123456");
    });

    expect(mockReplace).toHaveBeenCalledWith("/admin/change-password");
  });

  it("short-circuits straight to the redirect on a legacy (flag-off) response", async () => {
    const { wrapper } = createWrapper();
    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "ok", data: { admin: { id: "a1" }, tokens: null } }))
      .mockResolvedValueOnce(profileResponse({ mustChangePassword: false }));

    const { result } = renderHook(() => useAdminLoginFlow(), { wrapper });

    await act(async () => {
      await result.current.submitCredentials({ email: "admin@example.com", password: "pw" });
    });

    expect(result.current.step).toEqual({ kind: "credentials" });
    expect(hasAuthHint()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith("/admin/overview");
  });

  it("clears the error and returns to credentials via backToCredentials", async () => {
    const { wrapper } = createWrapper();
    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(otpChallengeResponse)
      .mockResolvedValueOnce(jsonResponse(errorEnvelope("Invalid code", "OTP_INVALID"), 401));

    const { result } = renderHook(() => useAdminLoginFlow(), { wrapper });

    await act(async () => {
      await result.current.submitCredentials({ email: "admin@example.com", password: "pw" });
    });
    await act(async () => {
      await result.current.submitOtp("000000");
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.backToCredentials();
    });

    expect(result.current.step).toEqual({ kind: "credentials" });
    expect(result.current.error).toBeNull();
  });
});

describe("useAdminLogout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
    mockReplace.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hits the logout endpoint, clears the hint and cache, and redirects to /admin/login", async () => {
    setAuthHint();
    expect(hasAuthHint()).toBe(true);

    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(["admin-profile"], { id: "a1" });

    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: "ok", data: { ok: true } }));

    const { result } = renderHook(() => useAdminLogout(), { wrapper });

    await act(async () => {
      await result.current();
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/logout");
    expect(hasAuthHint()).toBe(false);
    expect(queryClient.getQueryData(["admin-profile"])).toBeUndefined();
    expect(mockReplace).toHaveBeenCalledWith("/admin/login");
  });

  it("still clears the hint and redirects even if the logout request fails", async () => {
    setAuthHint();

    const { wrapper } = createWrapper();
    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, message: "boom" }, 500));

    const { result } = renderHook(() => useAdminLogout(), { wrapper });

    await act(async () => {
      await result.current();
    });

    expect(hasAuthHint()).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/admin/login");
  });
});

describe("useChangePassword", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refetches the profile after a successful change, clearing the mustChangePassword gate", async () => {
    const { wrapper, queryClient } = createWrapper();
    const fetchMock = getFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "Password changed", data: { ok: true } }))
      .mockResolvedValueOnce(profileResponse({ mustChangePassword: false }));

    const { result } = renderHook(() => useChangePassword(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ currentPassword: "old-pw", newPassword: "new-password" });
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admins/change-password");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/admins/profile");
    expect(queryClient.getQueryData(["admin-profile"])).toMatchObject({ mustChangePassword: false });
  });
});

describe("adminAuthErrorCopy", () => {
  it("maps each known auth error code to its friendly copy", () => {
    expect(adminAuthErrorCopy({ status: 429, code: "OTP_LOCKED", message: "x" })).toBe(
      "Too many incorrect codes. Start again to get a new one."
    );
    expect(adminAuthErrorCopy({ status: 401, code: "OTP_EXPIRED", message: "x" })).toBe(
      "That code expired. Request a new one."
    );
    expect(adminAuthErrorCopy({ status: 401, code: "OTP_INVALID", message: "x" })).toBe(
      "That code isn't right. Check and try again."
    );
    expect(adminAuthErrorCopy({ status: 401, code: "TEMP_PASSWORD_EXPIRED", message: "x" })).toBe(
      "Your temporary password expired. Ask an admin to resend your invite."
    );
    expect(adminAuthErrorCopy({ status: 401, code: "INVALID_CREDENTIALS", message: "x" })).toBe(
      "That email and password don't match."
    );
    expect(adminAuthErrorCopy({ status: 401, code: "TOTP_INVALID", message: "x" })).toBe(
      "That code isn't right. Try again, or use a backup code."
    );
    expect(adminAuthErrorCopy({ status: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "x" })).toBe(
      "Change your password to continue."
    );
    expect(adminAuthErrorCopy({ status: 403, code: "FORBIDDEN", message: "x" })).toBe(
      "You don't have permission to do that."
    );
  });

  it("maps a 429 without a recognized code to a generic rate-limit message", () => {
    expect(adminAuthErrorCopy({ status: 429, message: "x" })).toBe("Too many attempts. Wait a minute and try again.");
  });

  it("falls back to the raw error message for anything else", () => {
    expect(adminAuthErrorCopy({ status: 500, code: "SOMETHING_ELSE", message: "Server exploded" })).toBe(
      "Server exploded"
    );
    expect(adminAuthErrorCopy({ status: 400, message: "Bad request" })).toBe("Bad request");
  });
});
