import { isSessionExpiredError } from "@/lib/api/auth-errors";
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

  if (!response.ok) {
    // Parsed *before* the refresh decision on purpose: only the error code can
    // tell an expired session apart from a domain 401 (wrong password, wrong
    // OTP, wrong authenticator/backup code), and rotating the session fixes
    // exactly one of those.
    const error = await parseError(response);

    // 403 is not in this condition: neither `FORBIDDEN` nor
    // `PASSWORD_CHANGE_REQUIRED` is fixable by a refresh, so retrying only
    // doubled every forbidden request while rotating a refresh token whose
    // reuse detection may already have tripped.
    if (auth && retryOnUnauthorized && isSessionExpiredError(error)) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiRequest<T>(path, init, { auth, retryOnUnauthorized: false });
      }
    }

    // `AUTH_ROLE_MISMATCH` stays here regardless of status: a non-admin token
    // on an admin route is a dead end for this console whatever the status.
    if (auth && (isSessionExpiredError(error) || error.code === "AUTH_ROLE_MISMATCH")) {
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
