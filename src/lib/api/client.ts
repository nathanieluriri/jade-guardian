import { clearAuthState, getAuthState, setAuthState } from "@/lib/api/auth-storage";
import type { AdminRefreshResponse, ApiEnvelope, ApiError } from "@/lib/api/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

if (!API_BASE_URL) {
  console.warn("NEXT_PUBLIC_API_BASE_URL is not set");
}

let refreshPromise: Promise<string | null> | null = null;

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
    };

    return {
      status: response.status,
      message: body?.message || body?.detail || fallback,
      code: body?.code || body?.error_code,
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

async function refreshAccessToken(): Promise<string | null> {
  const auth = getAuthState();
  if (!auth) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/v1/admins/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: auth.refreshToken }),
      });

      if (!response.ok) {
        clearAuthState();
        return null;
      }

      const payload = (await response.json()) as ApiEnvelope<AdminRefreshResponse>;
      const nextState = {
        accessToken: payload.data?.access_token,
        refreshToken: payload.data?.refresh_token || auth.refreshToken,
      };

      if (!nextState.accessToken || !nextState.refreshToken) {
        clearAuthState();
        return null;
      }

      setAuthState(nextState);
      return nextState.accessToken;
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

  if (auth) {
    const token = getAuthState()?.accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      return apiRequest<T>(path, init, { auth, retryOnUnauthorized: false });
    }
  }

  if (!response.ok) {
    const error = await parseError(response);
    if (auth && (error.status === 401 || error.status === 403 || error.code === "AUTH_ROLE_MISMATCH")) {
      clearAuthState();
    }
    throw error;
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.requestId && payload.request_id) {
    payload.requestId = payload.request_id;
  }
  return payload;
}
