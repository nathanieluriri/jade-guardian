"use client";

import { SecurityTab } from "@/components/settings/security-tab";

/**
 * Self-service security settings. Sits inside the permission-checked admin shell
 * but is listed in `ALWAYS_ALLOWED_ADMIN_ROUTES` — the 2FA and password endpoints
 * behind it are in every access preset's self-service bundle, so no admin can be
 * locked out of their own account controls.
 */
export default function AdminSecuritySettingsPage() {
  return <SecurityTab />;
}
