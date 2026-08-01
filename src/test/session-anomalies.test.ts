import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSessionAnomalies } from "@/lib/api/admin-api";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function envelope(data: unknown) {
  return { success: true, message: "ok", data, requestId: "req_test" };
}

describe("fetchSessionAnomalies", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults every field when the backend returns an empty object", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(envelope({})));

    const result = await fetchSessionAnomalies();

    expect(result.active_sessions_by_admin).toEqual({});
    expect(result.global_active_sessions).toBe(0);
    expect(result.long_lived_session_count).toBe(0);
    expect(result.recent_session_spike_detected).toBe(false);
  });

  it("drops non-numeric session counts instead of passing them through", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse(envelope({ active_sessions_by_admin: { a1: 3, a2: "many", a3: null } })),
    );

    const result = await fetchSessionAnomalies();

    expect(result.active_sessions_by_admin).toEqual({ a1: 3 });
  });

  it("preserves a well-formed payload", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse(
        envelope({
          active_sessions_by_admin: { a1: 5 },
          global_active_sessions: 12,
          long_lived_session_count: 2,
          recent_session_spike_detected: true,
        }),
      ),
    );

    const result = await fetchSessionAnomalies();

    expect(result).toEqual({
      active_sessions_by_admin: { a1: 5 },
      global_active_sessions: 12,
      long_lived_session_count: 2,
      recent_session_spike_detected: true,
    });
  });

  it("normalizes active_sessions_by_admin when it is an array", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse(envelope({ active_sessions_by_admin: [1, 2, 3] })),
    );

    const result = await fetchSessionAnomalies();

    expect(result.active_sessions_by_admin).toEqual({});
  });

  it("normalizes active_sessions_by_admin when it is a string", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse(envelope({ active_sessions_by_admin: "not an object" })),
    );

    const result = await fetchSessionAnomalies();

    expect(result.active_sessions_by_admin).toEqual({});
  });

  it("defaults every field when response.data is null", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(envelope(null)));

    const result = await fetchSessionAnomalies();

    expect(result.active_sessions_by_admin).toEqual({});
    expect(result.global_active_sessions).toBe(0);
    expect(result.long_lived_session_count).toBe(0);
    expect(result.recent_session_spike_detected).toBe(false);
  });
});
