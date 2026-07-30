"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasAuthHint } from "@/lib/api/auth-storage";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { ADMIN_ROUTE_REQUIREMENTS, canAccessAdminRoute, resolveFirstAllowedAdminRoute } from "@/lib/admin-access";
import { BrandedSplash } from "@/components/auth/branded-splash";
import { PermissionDenied } from "@/components/feedback/permission-denied";

const SESSION_LOADING_LABEL = "Loading your admin session, please wait.";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasHint = hasAuthHint();
  const profileQuery = useAdminProfile();
  const mustChangePassword = profileQuery.data?.mustChangePassword === true;

  useEffect(() => {
    if (!hasHint) {
      router.replace("/admin/login");
      return;
    }

    if (profileQuery.isError) {
      router.replace("/admin/login");
      return;
    }

    if (!profileQuery.data) return;

    // The backend answers every permissioned endpoint with 403
    // PASSWORD_CHANGE_REQUIRED until this clears (see ADMIN_AUTH.md), so it
    // preempts the route-permission check below entirely: an admin on a
    // locked temporary password should always land on change-password, never
    // on PermissionDenied for whatever route they happened to request.
    if (mustChangePassword) {
      router.replace("/admin/change-password");
    }
  }, [hasHint, mustChangePassword, profileQuery.data, profileQuery.isError, router]);

  // The boot splash, not a spinner: when BootstrapGate releases early (safety
  // timeout) or the profile is still in flight, the user keeps looking at the
  // same surface instead of hopping splash → spinner → console. This also
  // covers the brief window where the profile query has errored (`data` is
  // undefined) and the effect above is about to redirect to login — holding
  // the splash there instead of falling through to `children` means the
  // permission-checked shell never renders for an admin whose session just
  // failed to resolve.
  if (!hasHint || profileQuery.isLoading || !profileQuery.data) {
    return <BrandedSplash label={SESSION_LOADING_LABEL} />;
  }

  if (mustChangePassword) {
    return <BrandedSplash label="Redirecting to set a new password, please wait." />;
  }

  if (pathname && !canAccessAdminRoute(pathname, profileQuery.data)) {
    return (
      <PermissionDenied
        requirements={ADMIN_ROUTE_REQUIREMENTS[pathname]}
        backHref={resolveFirstAllowedAdminRoute(profileQuery.data)}
      />
    );
  }

  return <>{children}</>;
}
