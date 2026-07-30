"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthState } from "@/lib/api/auth-storage";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { canAccessAdminRoute, resolveFirstAllowedAdminRoute } from "@/lib/admin-access";
import { AdminLoadingState } from "@/components/AdminLoadingState";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = getAuthState();
  const profileQuery = useAdminProfile();

  useEffect(() => {
    if (!auth?.accessToken) {
      router.replace("/admin/login");
      return;
    }

    if (profileQuery.isError) {
      router.replace("/admin/login");
      return;
    }

    if (profileQuery.data && pathname && !canAccessAdminRoute(pathname, profileQuery.data)) {
      router.replace(resolveFirstAllowedAdminRoute(profileQuery.data));
    }
  }, [auth?.accessToken, pathname, profileQuery.data, profileQuery.isError, router]);

  if (!auth?.accessToken || profileQuery.isLoading) {
    return <AdminLoadingState label="Loading admin session..." />;
  }

  if (profileQuery.data && pathname && !canAccessAdminRoute(pathname, profileQuery.data)) {
    return <AdminLoadingState label="Redirecting to available admin access..." />;
  }

  return <>{children}</>;
}
