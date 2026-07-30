"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordScreen } from "@/features/auth/components/change-password-screen";
import { hasAuthHint } from "@/lib/api/auth-storage";
import { AdminLoadingState } from "@/components/AdminLoadingState";

/**
 * Sits outside the permission-checked admin shell (see `src/app/admin/layout.tsx`):
 * an admin behind the `mustChangePassword` gate is 403'd on every other admin
 * endpoint, so no route requirement here could ever be satisfied. The auth
 * hint is still required — without a session there is nothing to change.
 *
 * Mirrors `AdminAuthGate`'s pattern: `hasAuthHint()` is a synchronous, non-sensitive
 * localStorage read (never a token), so it's safe to branch render on directly rather
 * than only inside the redirect effect — otherwise an unauthenticated visitor sees the
 * full change-password form flash for one paint before the effect fires the redirect.
 */
export default function AdminChangePasswordPage() {
  const router = useRouter();
  const hasHint = hasAuthHint();

  useEffect(() => {
    if (!hasHint) {
      router.replace("/admin/login");
    }
  }, [hasHint, router]);

  if (!hasHint) {
    return <AdminLoadingState label="Loading admin session..." />;
  }

  return <ChangePasswordScreen />;
}
