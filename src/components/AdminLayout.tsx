"use client";

import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { usePathname } from "next/navigation";
import { CommandBar } from "@/components/CommandBar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAdminRouteTitle } from "@/lib/admin-access";
import { useAdminTransition } from "@/components/admin-transition-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const routeKey = pathname || "";
  const pageTitle = getAdminRouteTitle(pathname || "");
  const { activeRouteKey, phase, transitionId, beginRouteChange, markEntering, markEntered } = useAdminTransition();

  useEffect(() => {
    if (!routeKey) return;
    beginRouteChange(routeKey);
  }, [beginRouteChange, routeKey]);

  useEffect(() => {
    if (!routeKey) return;
    if (activeRouteKey !== routeKey || phase !== "exiting") return;
    const currentTransitionId = transitionId;
    const frame = window.requestAnimationFrame(() => {
      markEntering(currentTransitionId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeRouteKey, markEntering, phase, routeKey, transitionId]);

  useEffect(() => {
    if (!routeKey) return;
    if (activeRouteKey !== routeKey || phase !== "entering") return;
    const currentTransitionId = transitionId;
    const timer = window.setTimeout(() => {
      markEntered(currentTransitionId);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [activeRouteKey, markEntered, phase, routeKey, transitionId]);

  useEffect(() => {
    if (!routeKey) return;
    if (activeRouteKey !== routeKey || phase === "idle") return;
    const currentTransitionId = transitionId;
    const watchdog = window.setTimeout(() => {
      markEntered(currentTransitionId);
    }, 700);
    return () => window.clearTimeout(watchdog);
  }, [activeRouteKey, markEntered, phase, routeKey, transitionId]);

  const isExiting = activeRouteKey === routeKey && phase === "exiting";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border/50 bg-card px-4 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-1" />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Cleanm</span>
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
            <div
              data-route-transition-phase={phase}
              style={{
                opacity: isExiting ? 0 : 1,
                transform: isExiting ? "translateY(-8px)" : "translateY(0)",
                transition: "opacity 240ms cubic-bezier(0.2, 0, 0, 1), transform 240ms cubic-bezier(0.2, 0, 0, 1)",
                willChange: "opacity, transform",
              }}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
