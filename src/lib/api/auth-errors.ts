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
