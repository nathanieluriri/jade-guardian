import type { ApiError } from "@/lib/api/types";

/**
 * Friendly copy for the admin-auth error codes documented in
 * `ADMIN_AUTH.md`. Order matters: specific error codes are checked first,
 * then the code-less 429 (generic rate limit) case, then the raw backend
 * message as a last resort.
 */
export function adminAuthErrorCopy(error: ApiError): string {
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
      return "That email and password don't match.";
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
