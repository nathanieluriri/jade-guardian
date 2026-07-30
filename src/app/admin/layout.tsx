"use client";

import { usePathname } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { AdminAuthGate } from "@/components/auth/AdminAuthGate";
import { AdminTransitionProvider } from "@/components/admin-transition-provider";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
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
