"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthState } from "@/lib/api/auth-storage";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { resolveFirstAllowedAdminRoute } from "@/lib/admin-access";
import { AdminLoadingState } from "@/components/AdminLoadingState";

export default function AdminIndexPage() {
  const router = useRouter();
  const profileQuery = useAdminProfile();
  const auth = getAuthState();

  useEffect(() => {
    if (!auth?.accessToken) {
      router.replace("/admin/login");
      return;
    }

    if (profileQuery.data) {
      router.replace(resolveFirstAllowedAdminRoute(profileQuery.data));
    }
  }, [auth?.accessToken, profileQuery.data, router]);

  return <AdminLoadingState label="Resolving admin landing page..." />;
}
