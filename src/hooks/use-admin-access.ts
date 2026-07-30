"use client";

import { useMemo } from "react";
import { canAccessAdminRoute, getAllowedAdminRoutes, resolveFirstAllowedAdminRoute } from "@/lib/admin-access";
import { useAdminProfile } from "@/hooks/use-admin-auth";

export function useAdminAccess() {
  const profileQuery = useAdminProfile();

  const allowedRoutes = useMemo(() => getAllowedAdminRoutes(profileQuery.data), [profileQuery.data]);

  return {
    profileQuery,
    allowedRoutes,
    canAccessRoute: (pathname: string) => canAccessAdminRoute(pathname, profileQuery.data),
    firstAllowedRoute: resolveFirstAllowedAdminRoute(profileQuery.data),
  };
}

