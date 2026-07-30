export const AUTH_HINT_KEY = "admin_auth_hint_v1";

/**
 * The admin session itself lives in httpOnly cookies the browser never reads.
 * This flag is a non-sensitive, synchronous tripwire only: "the last thing we
 * knew, this browser had completed login." It drives instant UI decisions
 * (route guard, splash screen) before the real authority — a `GET /profile`
 * call — resolves. It must never hold a token.
 */
export function hasAuthHint(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTH_HINT_KEY) === "1";
}

export function setAuthHint(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_HINT_KEY, "1");
}

export function clearAuthHint(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_HINT_KEY);
}
