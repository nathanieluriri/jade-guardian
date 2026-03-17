export const AUTH_STORAGE_KEY = "admin_auth_v1";

export interface AdminAuthState {
  accessToken: string;
  refreshToken: string;
}

export function getAuthState(): AdminAuthState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AdminAuthState>;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    return null;
  }
}

export function setAuthState(state: AdminAuthState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

export function clearAuthState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
