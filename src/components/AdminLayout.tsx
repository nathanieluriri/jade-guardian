"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CommandBar } from "@/components/CommandBar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const routeTitles: Record<string, string> = {
  "/admin/overview": "Overview",
  "/admin/security/alerts": "Alerts",
  "/admin/security/sessions": "Sessions",
  "/admin/security/audit": "Audit Log",
  "/admin/permissions/catalog": "Permission Catalog",
  "/admin/permissions/templates": "Role Templates",
  "/admin/onboarding/cleaners": "Cleaner Onboarding",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageTitle = routeTitles[pathname || ""] || "Dashboard";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border/50 bg-card px-4 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-1" />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Sentinel</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="font-medium text-foreground">{pageTitle}</span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 ml-4 px-2 py-0.5 rounded-full bg-primary/10">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
                <span className="font-mono-data text-primary text-[10px]">Healthy</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CommandBar />
              <Avatar className="h-7 w-7 border border-border/50">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                  SA
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
