"use client";

import { usePathname } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { AdminAuthGate } from "@/components/auth/AdminAuthGate";
import { AdminTransitionProvider } from "@/components/admin-transition-provider";

/**
 * Full-screen auth surfaces render without the admin shell or its
 * route-permission check: `/admin/change-password` has to stay reachable while
 * every permissioned endpoint still answers 403 PASSWORD_CHANGE_REQUIRED.
 */
const BARE_ADMIN_ROUTES = ["/admin/login", "/admin/change-password"];

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname && BARE_ADMIN_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <AdminAuthGate>
      <AdminTransitionProvider>
        <AdminLayout>{children}</AdminLayout>
      </AdminTransitionProvider>
    </AdminAuthGate>
  );
}
