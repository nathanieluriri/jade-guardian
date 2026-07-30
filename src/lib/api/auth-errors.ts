import type { ApiError } from "@/lib/api/types";

/**
 * Friendly copy for the admin-auth error codes documented in
 * `ADMIN_AUTH.md`. Order matters: specific error codes are checked first,
 * then the code-less 429 (generic rate limit) case, then the raw backend
 * message as a last resort.
 *
 * `context` disambiguates error codes the backend reuses across screens.
 * `INVALID_CREDENTIALS` is thrown for both "wrong email/password" on login
 * and "wrong current password" on change-password (same code, same message,
 * per ADMIN_AUTH.md's error table and `admin-service.ts`'s `changePassword`,
 * which calls the identical `invalidCredentials()` helper as `login`). The
 * login copy mentions email; change-password has no email field, so a
 * mistyped temp password would otherwise show a non-sequitur. Defaults to
 * the login copy so every existing call site is unaffected.
 */
export function adminAuthErrorCopy(
  error: ApiError,
  context?: "login" | "change-password"
): string {
  switch (error.code) {
    case "OTP_LOCKED":
      return "Too many incorrect codes. Start again to get a new one.";
    case "OTP_EXPIRED":
      return "That code expired. Request a new one.";
    case "OTP_INVALID":
      return "That code isn't right. Check and try again.";
    case "TEMP_PASSWORD_EXPIRED":
      return "Your temporary password expired. Ask an admin to resend your invite.";
    case "INVALID_CREDENTIALS":
      return context === "change-password"
        ? "That current password isn't right."
        : "That email and password don't match.";
    case "TOTP_INVALID":
      return "That code isn't right. Try again, or use a backup code.";
    case "PASSWORD_CHANGE_REQUIRED":
      return "Change your password to continue.";
    case "FORBIDDEN":
      return "You don't have permission to do that.";
    default:
      break;
  }

  if (error.status === 429 && !error.code) {
    return "Too many attempts. Wait a minute and try again.";
  }

  return error.message;
}

/**
 * Domain error codes the backend answers with **401** — the same status an
 * expired session gets (see ADMIN_AUTH.md's error table).
 *
 * Every one of these means "that password/code was wrong", never "your session
 * is gone": `INVALID_CREDENTIALS` and `TEMP_PASSWORD_EXPIRED` arrive on login
 * and change-password, `OTP_INVALID`/`OTP_EXPIRED` on verify-otp, and
 * `TOTP_INVALID` on every 2FA route (`2fa/verify`, `2fa` disable,
 * `2fa/backup-codes/regenerate`). Reading them as session failures signs the
 * admin out on a single typo — one mistyped temporary password on the forced
 * invite journey, or one wrong authenticator/backup code in security settings.
 * In the TOTP stepper that is worse than a bounce: the pending secret is
 * already stored server-side, so enrollment has to restart from the QR step.
 *
 * `OTP_LOCKED` is documented as 429, and is listed anyway so a deployment that
 * answers it with 401 can't sign the admin out either.
 */
export const DOMAIN_401_CODES: ReadonlySet<string> = new Set([
  "INVALID_CREDENTIALS",
  "TEMP_PASSWORD_EXPIRED",
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_LOCKED",
  "TOTP_INVALID",
]);

/**
 * True only for a 401 the *session* failed on: status 401 carrying no domain
 * code from `DOMAIN_401_CODES`.
 *
 * The single gate for "clear the auth hint / bounce to /admin/login", shared by
 * `apiRequest` and the query-cache error handler in `providers.tsx` so the two
 * can never disagree about what counts as an expired session. Deliberately
 * conservative: an unrecognised 401 code (`AUTH_INVALID`, a future one) still
 * counts as expiry, so a genuinely dead session is never mistaken for a
 * recoverable form error.
 */
export function isSessionExpiredError(error: { status?: number; code?: string }): boolean {
  if (error.status !== 401) return false;
  return !(error.code && DOMAIN_401_CODES.has(error.code));
}
