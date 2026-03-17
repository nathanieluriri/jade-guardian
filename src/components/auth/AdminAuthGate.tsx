"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthState } from "@/lib/api/auth-storage";
import { useAdminProfile } from "@/hooks/use-admin-auth";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = getAuthState();
  const profileQuery = useAdminProfile();

  useEffect(() => {
    if (!auth?.accessToken) {
      router.replace("/admin/login");
      return;
    }

    if (profileQuery.isError) {
      router.replace("/admin/login");
    }
  }, [auth?.accessToken, profileQuery.isError, router]);

  if (!auth?.accessToken || profileQuery.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="font-mono-data text-muted-foreground">Loading admin session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
