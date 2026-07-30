"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Bell,
  Shield,
  Monitor,
  FileSearch,
  Key,
  Users,
  UserCheck,
  ChevronLeft,
  Building2,
  UserCog,
  Loader2,
  Moon,
  Sun,
  LogOut,
  ChevronDown,
  LockKeyhole,
  Send,
  ListChecks,
  Wrench,
  FileText,
  Package,
  LineChart,
  MapPin,
  Ticket,
  LifeBuoy,
  MessageSquare,
  FileCheck,
  Coins,
  Wallet,
  Radio,
  Megaphone,
  Tags,
  CalendarClock
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { fetchAlerts, listElevationRequests } from "@/lib/api/admin-api";
import { motion, AnimatePresence } from "framer-motion";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { useAdminLogout } from "@/hooks/use-admin-auth";

type SidebarLinkItem = {
  kind: "link";
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
};

type SidebarGroupItem = {
  kind: "group";
  title: string;
  icon: typeof LayoutDashboard;
  subItems: SidebarLinkItem[];
};

type SidebarMenuEntry = SidebarLinkItem | SidebarGroupItem;

const menuItems: SidebarMenuEntry[] = [
  { kind: "link", title: "Overview", url: "/admin/overview", icon: LayoutDashboard },
  {
    kind: "group",
    title: "User Management",
    icon: Building2,
    subItems: [
      { kind: "link", title: "Users", url: "/admin/users", icon: Users },
      { kind: "link", title: "Employees", url: "/admin/institutions/employees", icon: UserCheck },
      { kind: "link", title: "Admin Team", url: "/admin/team", icon: UserCog },
    ],
  },
  {
    kind: "group",
    title: "Security",
    icon: Shield,
    subItems: [
      { kind: "link", title: "Alerts", url: "/admin/security/alerts", icon: Bell },
      { kind: "link", title: "Sessions", url: "/admin/security/sessions", icon: Monitor },
      { kind: "link", title: "Audit Log", url: "/admin/security/audit", icon: FileSearch },
    ],
  },
  {
    kind: "group",
    title: "Access Control",
    icon: Key,
    subItems: [
      { kind: "link", title: "Permission Catalog", url: "/admin/permissions/catalog", icon: Key },
      { kind: "link", title: "Role Templates", url: "/admin/permissions/templates", icon: Users },
    ],
  },
  {
    kind: "group",
    title: "Access Requests",
    icon: LockKeyhole,
    subItems: [
      { kind: "link", title: "Access Hub", url: "/admin/access", icon: LockKeyhole },
      { kind: "link", title: "Permission Groups", url: "/admin/access/permission-groups", icon: Key },
      { kind: "link", title: "Request Elevation", url: "/admin/access/request-elevation", icon: Send },
      { kind: "link", title: "Access Requests", url: "/admin/access/requests", icon: ListChecks },
    ],
  },
  {
    kind: "group",
    title: "Operations Core",
    icon: Wrench,
    subItems: [
      { kind: "link", title: "Service Definitions", url: "/admin/operations/service-definitions", icon: FileText },
      { kind: "link", title: "Add-ons", url: "/admin/operations/add-ons", icon: Package },
      { kind: "link", title: "Pricing Rules", url: "/admin/operations/pricing-rules", icon: LineChart },
      { kind: "link", title: "Service Areas", url: "/admin/operations/service-areas", icon: MapPin },
      { kind: "link", title: "Promo Codes", url: "/admin/operations/promo-codes", icon: Ticket },
    ],
  },
  {
    kind: "group",
    title: "Support Core",
    icon: LifeBuoy,
    subItems: [
      { kind: "link", title: "Concierge Bookings", url: "/admin/support/concierge-bookings", icon: LifeBuoy },
      { kind: "link", title: "Chat Interventions", url: "/admin/support/chat-interventions", icon: MessageSquare },
      { kind: "link", title: "Claim Reviews", url: "/admin/support/claim-reviews", icon: FileCheck },
      { kind: "link", title: "Service Credits", url: "/admin/support/service-credits", icon: Coins },
      { kind: "link", title: "Payout Adjustments", url: "/admin/support/payout-adjustments", icon: Wallet },
    ],
  },
  {
    kind: "group",
    title: "Comms & Governance",
    icon: Radio,
    subItems: [
      { kind: "link", title: "Broadcasts", url: "/admin/governance/broadcasts", icon: Megaphone },
      { kind: "link", title: "Cleaner Tags", url: "/admin/governance/cleaner-tags", icon: Tags },
      { kind: "link", title: "Availability Overrides", url: "/admin/governance/availability-overrides", icon: CalendarClock },
    ],
  },
];

export function AdminSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const { allowedRoutes, canAccessRoute, profileQuery } = useAdminAccess();
  const logout = useAdminLogout();
  const { resolvedTheme, setTheme } = useTheme();
  const alertsQuery = useQuery({
    queryKey: ["open-alert-attention-count"],
    queryFn: () => fetchAlerts({ status: "open", unreadOnly: true, start: 0, stop: 99 }),
    refetchInterval: 30_000,
    enabled: canAccessRoute("/admin/security/alerts"),
  });
  const pendingElevationQuery = useQuery({
    queryKey: ["pending-elevation-request-count"],
    queryFn: () => listElevationRequests({ status: "PENDING", start: 0, stop: 200 }),
    refetchInterval: 30_000,
    enabled: canAccessRoute("/admin/access/requests"),
  });
  const alertAttentionCount = alertsQuery.data?.length || 0;
  const pendingElevationCount = pendingElevationQuery.data?.length || 0;
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    "User Management": false,
    Security: false,
    "Access Control": false,
    "Access Requests": false,
    "Operations Core": false,
    "Support Core": false,
    "Comms & Governance": false,
  });

  const displayName = useMemo(() => {
    const fullName = profileQuery.data?.full_name?.trim();
    if (fullName) return fullName;
    const email = profileQuery.data?.email?.trim();
    if (email) return email.split("@")[0] || "Admin";
    return "Admin";
  }, [profileQuery.data?.email, profileQuery.data?.full_name]);

  const displayEmail = useMemo(() => {
    const email = profileQuery.data?.email?.trim();
    return email || "No email";
  }, [profileQuery.data?.email]);

  const initials = useMemo(() => {
    const tokens = displayName.split(" ").filter(Boolean);
    if (tokens.length >= 2) {
      return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
    }
    if (tokens.length === 1) {
      return tokens[0].slice(0, 2).toUpperCase();
    }
    return "AD";
  }, [displayName]);

  const isDarkMode = resolvedTheme === "dark";
  const themeLabel = isDarkMode ? "Light Mode" : "Dark Mode";
  const handleToggleTheme = () => {
    const nextTheme = isDarkMode ? "light" : "dark";
    setTheme(nextTheme);
    document.cookie = `theme=${nextTheme}; path=/; max-age=31536000; samesite=lax`;
  };

  const visibleMenuItems = useMemo(() => {
    return menuItems
      .map((item) => {
        if (item.kind === "link") {
          return allowedRoutes.has(item.url) ? item : null;
        }
        const visibleSubItems = item.subItems.filter((subItem) => allowedRoutes.has(subItem.url));
        if (visibleSubItems.length === 0) return null;
        return { ...item, subItems: visibleSubItems };
      })
      .filter((item): item is SidebarMenuEntry => item !== null);
  }, [allowedRoutes]);

  const visibleGroupTitles = useMemo(
    () => visibleMenuItems.filter((item): item is SidebarGroupItem => item.kind === "group").map((item) => item.title),
    [visibleMenuItems]
  );

  const activeGroupTitle = useMemo(() => {
    const activeGroup = visibleMenuItems.find(
      (item): item is SidebarGroupItem => item.kind === "group" && item.subItems.some((subItem) => pathname === subItem.url)
    );
    return activeGroup?.title ?? null;
  }, [pathname, visibleMenuItems]);

  useEffect(() => {
    setPendingNavigationHref(null);
  }, [pathname]);

  useEffect(() => {
    if (visibleGroupTitles.length === 0) return;
    const nextState = visibleGroupTitles.reduce<Record<string, boolean>>((acc, title) => {
      acc[title] = title === activeGroupTitle;
      return acc;
    }, {});
    setExpandedItems(nextState);
  }, [activeGroupTitle, visibleGroupTitles]);

  const toggleItem = (title: string, e: React.MouseEvent) => {
    e.preventDefault();
    setExpandedItems((prev) => {
      const next = visibleGroupTitles.reduce<Record<string, boolean>>((acc, groupTitle) => {
        acc[groupTitle] = false;
        return acc;
      }, {});
      next[title] = !prev[title];
      return next;
    });
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0" style={{ borderRight: "1px solid hsl(var(--sidebar-border))" }}>
      <SidebarHeader className="px-4 py-5 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-1">
            <Image
              src="/company_logo.png"
              alt="Cleanm logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
          </div>
          {!collapsed && <span className="text-2xl font-bold tracking-tight text-white">Cleanm</span>}
        </div>
        {!collapsed && (
          <button onClick={toggleSidebar} className="text-white hover:bg-sidebar-accent p-1 rounded-md transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </SidebarHeader>

      <SidebarSeparator className="bg-[hsl(var(--sidebar-group-border))] opacity-50 mb-2 mx-0" />

      <SidebarContent className="px-3 scrollbar-thin pb-4">
        {!collapsed && (
          <div className="px-3 py-2 text-[11px] font-semibold text-sidebar-muted uppercase tracking-widest mb-1">
            MAIN MENU
          </div>
        )}
        
        <SidebarMenu className="gap-1">
          {visibleMenuItems.map((item) => {
            const hasSub = item.kind === "group";
            const isExpanded = !!expandedItems[item.title];
            
            // Determine if parent or any child is active
            const isActive = item.kind === "link" ? pathname === item.url : item.subItems.some((subItem) => pathname === subItem.url);

            return (
              <SidebarMenuItem key={item.title} className="flex flex-col">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    {hasSub ? (
                      <button
                        onClick={(e) => toggleItem(item.title, e)}
                        className={cn(
                          "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors duration-200 outline-none",
                          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                          isExpanded && "bg-sidebar-accent/20 text-white/80",
                          isActive && "bg-sidebar-accent/50 text-white"
                        )}
                      >
                        <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.5} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">{item.title}</span>
                            {isActive && <span className="h-2 w-2 rounded-full bg-sidebar-primary shrink-0" />}
                            <ChevronDown 
                              className={cn("h-4 w-4 shrink-0 transition-transform duration-200 text-sidebar-muted", isExpanded && "rotate-180")} 
                            />
                          </>
                        )}
                      </button>
                    ) : (
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.url}
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors duration-200 outline-none",
                            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                            isActive && "bg-sidebar-accent/50 text-white",
                            pendingNavigationHref === item.url && "opacity-80 pointer-events-none"
                          )}
                          onClick={() => setPendingNavigationHref(item.url || null)}
                        >
                          <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.5} />
                          {!collapsed && (
                            <>
                              <span>{item.title}</span>
                              {pendingNavigationHref === item.url && (
                                <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                              )}
                            </>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="bg-sidebar-active text-sidebar-active-foreground border-0 font-medium">
                      {item.title}
                    </TooltipContent>
                  )}
                </Tooltip>

                {/* Sub-items */}
                {hasSub && !collapsed && (
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="ml-[22px] mt-1 pl-[18px] border-l border-sidebar-border/60 flex flex-col gap-1 py-1">
                          {item.subItems.map((sub) => {
                            const isSubActive = pathname === sub.url;
                            return (
                              <Link
                                key={sub.title}
                                href={sub.url}
                                className={cn(
                                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors duration-200 outline-none",
                                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",

                                  isSubActive && "bg-sidebar-primary/50 text-white",
                                  pendingNavigationHref === sub.url && "opacity-80 pointer-events-none"
                                )}
                                onClick={() => setPendingNavigationHref(sub.url)}
                              >
                                <sub.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                                <span className="flex-1">{sub.title}</span>
                                {/* uncomment and adjust style accordingly {isSubActive && <span className="h-1 w-15 rounded-full bg-sidebar-primary shrink-0" />} */}
                                {pendingNavigationHref === sub.url && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                )}
                                {sub.url === "/admin/security/alerts" && alertAttentionCount > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-mono-data bg-red-500 hover:bg-red-600 text-white border-0"
                                  >
                                    {alertAttentionCount > 99 ? "99+" : alertAttentionCount}
                                  </Badge>
                                )}
                                {(sub.url === "/admin/access/request-elevation" || sub.url === "/admin/access/requests") &&
                                  pendingElevationCount > 0 && (
                                    <Badge
                                      variant="warning"
                                      className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-mono-data"
                                    >
                                      {pendingElevationCount > 99 ? "99+" : pendingElevationCount}
                                    </Badge>
                                  )}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-[hsl(var(--sidebar-border))] p-4">
        <div className={cn("flex items-center gap-3 rounded-md mb-4", !collapsed && "")}>
          <Avatar className="h-10 w-10 shrink-0 bg-[#6d798a]">
            <AvatarFallback className="bg-[#6d798a] text-white text-sm font-semibold">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-semibold text-white truncate">{displayName}</span>
              <span className="text-[12px] text-sidebar-foreground truncate">{displayEmail}</span>
            </div>
          )}
        </div>

        {!collapsed ? (
          <div className="flex flex-col gap-1 w-full">
            <button
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors duration-200 outline-none"
              onClick={handleToggleTheme}
            >
              {isDarkMode ? <Sun className="h-5 w-5 shrink-0" strokeWidth={1.5} /> : <Moon className="h-5 w-5 shrink-0" strokeWidth={1.5} />}
              <span>{themeLabel}</span>
            </button>
            <button
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors duration-200 outline-none"
              onClick={() => void logout()}
            >
              <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.5} />
              <span>Log Out</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="rounded-xl p-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors duration-200 outline-none"
                  onClick={handleToggleTheme}
                >
                  {isDarkMode ? <Sun className="h-5 w-5 shrink-0" strokeWidth={1.5} /> : <Moon className="h-5 w-5 shrink-0" strokeWidth={1.5} />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-sidebar-active text-sidebar-active-foreground border-0 font-medium">
                {themeLabel}
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="rounded-xl p-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors duration-200 outline-none"
                  onClick={() => void logout()}
                >
                  <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-sidebar-active text-sidebar-active-foreground border-0 font-medium">
                Log Out
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
