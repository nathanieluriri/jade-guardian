"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasAuthHint } from "@/lib/api/auth-storage";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { resolveFirstAllowedAdminRoute } from "@/lib/admin-access";
import { AdminLoadingState } from "@/components/AdminLoadingState";

export default function AdminIndexPage() {
  const router = useRouter();
  const profileQuery = useAdminProfile();
  const hasHint = hasAuthHint();

  useEffect(() => {
    if (!hasHint) {
      router.replace("/admin/login");
      return;
    }

    if (profileQuery.data) {
      router.replace(resolveFirstAllowedAdminRoute(profileQuery.data));
    }
  }, [hasHint, profileQuery.data, router]);

  return <AdminLoadingState label="Resolving admin landing page..." />;
}
