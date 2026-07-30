import { clearAuthHint } from "@/lib/api/auth-storage";
import type { ApiEnvelope, ApiError } from "@/lib/api/types";

// Requests are always same-origin, relative `/api/...` paths: the Next rewrite
// in next.config.mjs proxies them to the real backend so the admin_access /
// admin_refresh httpOnly cookies stay first-party (SameSite=Lax survives).
// See the "Cookie transport decision" in the phase plan — never point this at
// a cross-origin absolute URL.
const API_BASE_URL = "";

let refreshPromise: Promise<boolean> | null = null;

function normalizeRequestId(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const payload = body as { requestId?: string; request_id?: string };
  return payload.requestId || payload.request_id;
}

async function parseError(response: Response): Promise<ApiError> {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: string;
      detail?: string;
      code?: string;
      error_code?: string;
      data?: {
        code?: string;
        details?: unknown;
      };
    };

    const resolvedCode = body?.code || body?.error_code || body?.data?.code;

    return {
      status: response.status,
      message: body?.message || body?.detail || fallback,
      code: resolvedCode,
      requestId: normalizeRequestId(body),
      details: body,
    };
  } catch {
    return {
      status: response.status,
      message: fallback,
    };
  }
}

/**
 * Rotates the session via the httpOnly `admin_refresh` cookie. No request
 * body and no token reading: the cookie carries the refresh token, and the
 * backend re-sets both cookies on success. Single-flight so concurrent 401s
 * only trigger one refresh call.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/admins/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        clearAuthHint();
        return false;
      }

      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean; retryOnUnauthorized?: boolean } = {}
): Promise<ApiEnvelope<T>> {
  const { auth = true, retryOnUnauthorized = true } = options;

  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if ((response.status === 401 || response.status === 403) && auth && retryOnUnauthorized) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, init, { auth, retryOnUnauthorized: false });
    }
  }

  if (!response.ok) {
    const error = await parseError(response);
    if (auth && (error.status === 401 || error.code === "AUTH_ROLE_MISMATCH")) {
      clearAuthHint();
    }
    throw error;
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.requestId && payload.request_id) {
    payload.requestId = payload.request_id;
  }
  return payload;
}
