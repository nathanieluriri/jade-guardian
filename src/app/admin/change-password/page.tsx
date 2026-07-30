"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordScreen } from "@/features/auth/components/change-password-screen";
import { hasAuthHint } from "@/lib/api/auth-storage";

/**
 * Sits outside the permission-checked admin shell (see `src/app/admin/layout.tsx`):
 * an admin behind the `mustChangePassword` gate is 403'd on every other admin
 * endpoint, so no route requirement here could ever be satisfied. The auth
 * hint is still required — without a session there is nothing to change.
 */
export default function AdminChangePasswordPage() {
  const router = useRouter();

  useEffect(() => {
    if (!hasAuthHint()) {
      router.replace("/admin/login");
    }
  }, [router]);

  return <ChangePasswordScreen />;
}
