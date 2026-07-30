"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasAuthHint } from "@/lib/api/auth-storage";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { canAccessAdminRoute, resolveFirstAllowedAdminRoute } from "@/lib/admin-access";
import { AdminLoadingState } from "@/components/AdminLoadingState";
import { BrandedSplash } from "@/components/auth/branded-splash";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasHint = hasAuthHint();
  const profileQuery = useAdminProfile();

  useEffect(() => {
    if (!hasHint) {
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
  }, [hasHint, pathname, profileQuery.data, profileQuery.isError, router]);

  // The boot splash, not a spinner: when BootstrapGate releases early (safety
  // timeout) or the profile is still in flight, the user keeps looking at the
  // same surface instead of hopping splash → spinner → console.
  if (!hasHint || profileQuery.isLoading) {
    return <BrandedSplash label="Loading your admin session, please wait." />;
  }

  if (profileQuery.data && pathname && !canAccessAdminRoute(pathname, profileQuery.data)) {
    return <AdminLoadingState label="Redirecting to available admin access..." />;
  }

  return <>{children}</>;
}
