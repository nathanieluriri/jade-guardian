"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  LayoutGrid,
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
  CalendarClock,
  ShieldCheck
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
import {
  fetchAlerts,
  listElevationRequests,
  listServiceDefinitions,
  listAddOns,
  listPricingRules,
  listServiceAreas,
  listPromoCodes,
} from "@/lib/api/admin-api";
import { OPERATIONS_LIST_PAGE } from "@/features/admin/screens/operations/optimistic-delete";
import { motion, AnimatePresence } from "framer-motion";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { useAdminLogout } from "@/hooks/use-admin-auth";
import { SECURITY_SETTINGS_ROUTE } from "@/lib/admin-access";

export type NavPrefetch = { queryKey: unknown[]; queryFn: () => Promise<unknown> };

/**
 * Warms a nav item's data on hover so the click lands on a populated cache instead of a
 * loading state. `staleTime` here mirrors the global 60s default: hovering a link whose
 * data is still fresh must not trigger a network request.
 */
export async function prefetchNavItem(
  client: QueryClient,
  item: { prefetch?: NavPrefetch },
): Promise<void> {
  if (!item.prefetch) return;
  await client.prefetchQuery({
    queryKey: item.prefetch.queryKey,
    queryFn: item.prefetch.queryFn,
    staleTime: 60_000,
  });
}

type SidebarLinkItem = {
  kind: "link";
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  /**
   * One line saying what the destination actually is. Surfaced in the nav
   * tooltip and reused verbatim as the ⌘K subtitle (see `adminNavDescription`),
   * so a label like "Sessions" or "Access Hub" doesn't have to carry the whole
   * meaning on its own. Copy is drawn from each screen's own sub-heading rather
   * than invented here.
   */
  description: string;
  /** Optional query to warm on hover/focus so the click lands on populated data. */
  prefetch?: NavPrefetch;
};

type SidebarGroupItem = {
  kind: "group";
  title: string;
  icon: typeof LayoutDashboard;
  description: string;
  subItems: SidebarLinkItem[];
};

type SidebarMenuEntry = SidebarLinkItem | SidebarGroupItem;

const menuItems: SidebarMenuEntry[] = [
  {
    kind: "link",
    title: "Overview",
    url: "/admin/overview",
    icon: LayoutGrid,
    description: "System-wide health, session and alert counters at a glance.",
  },
  {
    kind: "group",
    title: "User Management",
    icon: Building2,
    description: "Customer accounts, cleaner employees, and the admin team itself.",
    subItems: [
      {
        kind: "link",
        title: "Users",
        url: "/admin/users",
        icon: Users,
        description: "Customer directory with KPI and trend cards from the reporting APIs.",
      },
      {
        kind: "link",
        title: "Employees",
        url: "/admin/institutions/employees",
        icon: UserCheck,
        description: "Onboarding queue: review pending cleaner profiles and decide approval.",
      },
      {
        kind: "link",
        title: "Admin Team",
        url: "/admin/team",
        icon: UserCog,
        description: "Invite admins, re-scope their access preset, and review 2FA posture.",
      },
    ],
  },
  {
    kind: "group",
    title: "Security",
    icon: Shield,
    description: "Alerts, live sessions, the audit trail, and your own second factor.",
    subItems: [
      {
        kind: "link",
        title: "Alerts",
        url: "/admin/security/alerts",
        icon: Bell,
        description: "Operational alert queue with bulk actions and investigation links.",
      },
      {
        kind: "link",
        title: "Sessions",
        url: "/admin/security/sessions",
        icon: Monitor,
        description: "Session risk panel: active sessions and anomaly metrics.",
      },
      {
        kind: "link",
        title: "Audit Log",
        url: "/admin/security/audit",
        icon: FileSearch,
        description: "Every admin action, with the request id attached.",
      },
      // Self-service, so it is always in `allowedRoutes` — this group therefore
      // never disappears entirely, even for an admin with no monitoring access.
      {
        kind: "link",
        title: "Account Security",
        url: SECURITY_SETTINGS_ROUTE,
        icon: ShieldCheck,
        description: "Your own two-factor authentication and password controls.",
      },
    ],
  },
  {
    kind: "group",
    title: "Access Control",
    icon: Key,
    description: "The permission catalog and the role templates built from it.",
    subItems: [
      {
        kind: "link",
        title: "Permission Catalog",
        url: "/admin/permissions/catalog",
        icon: Key,
        description: "Every permission the backend recognises, by method and path.",
      },
      {
        kind: "link",
        title: "Role Templates",
        url: "/admin/permissions/templates",
        icon: Users,
        description: "Named permission bundles, with policy lint warnings.",
      },
    ],
  },
  {
    kind: "group",
    title: "Access Requests",
    icon: LockKeyhole,
    description: "Elevation requests and the permission groups they draw on.",
    subItems: [
      {
        kind: "link",
        title: "Access Hub",
        url: "/admin/access",
        icon: LockKeyhole,
        description: "What your account can reach, and what to do if it can't reach enough.",
      },
      {
        kind: "link",
        title: "Permission Groups",
        url: "/admin/access/permission-groups",
        icon: Key,
        description: "The groups that can be requested when submitting an elevation request.",
      },
      {
        kind: "link",
        title: "Request Elevation",
        url: "/admin/access/request-elevation",
        icon: Send,
        description: "Select permission groups and submit your request for approval.",
      },
      {
        kind: "link",
        title: "Access Requests",
        url: "/admin/access/requests",
        icon: ListChecks,
        description: "Review pending elevation requests and issue approval decisions.",
      },
    ],
  },
  {
    kind: "group",
    title: "Operations Core",
    icon: Wrench,
    description: "Services, add-ons, pricing, coverage areas, and promo codes.",
    subItems: [
      {
        kind: "link",
        title: "Service Definitions",
        url: "/admin/operations/service-definitions",
        icon: FileText,
        description: "Base cleaning services used by the booking and pricing flows.",
        prefetch: {
          queryKey: ["operations", "service-definitions"],
          queryFn: () => listServiceDefinitions({ skip: 0, limit: 100 }),
        },
      },
      {
        kind: "link",
        title: "Add-ons",
        url: "/admin/operations/add-ons",
        icon: Package,
        description: "Optional add-ons attached to bookings.",
        prefetch: {
          queryKey: ["operations", "add-ons"],
          queryFn: () => listAddOns({ skip: 0, limit: 100 }),
        },
      },
      {
        kind: "link",
        title: "Pricing Rules",
        url: "/admin/operations/pricing-rules",
        icon: LineChart,
        description: "Conditional multipliers and rule priority for operational pricing.",
        prefetch: {
          queryKey: ["operations", "pricing-rules"],
          queryFn: () => listPricingRules({ skip: 0, limit: 100 }),
        },
      },
      {
        kind: "link",
        title: "Service Areas",
        url: "/admin/operations/service-areas",
        icon: MapPin,
        description: "Operational zone boundaries and covered zip codes.",
        prefetch: {
          queryKey: ["operations", "service-areas"],
          queryFn: () => listServiceAreas({ skip: 0, limit: 100 }),
        },
      },
      {
        kind: "link",
        title: "Promo Codes",
        url: "/admin/operations/promo-codes",
        icon: Ticket,
        description: "Discount campaigns and redemption lifecycle controls.",
        prefetch: {
          queryKey: ["operations", "promo-codes"],
          queryFn: () => listPromoCodes({ skip: 0, limit: 100 }),
        },
      },
    ],
  },
  {
    kind: "group",
    title: "Support Core",
    icon: LifeBuoy,
    description: "Concierge bookings, chat, claims, credits, and payout corrections.",
    subItems: [
      {
        kind: "link",
        title: "Concierge Bookings",
        url: "/admin/support/concierge-bookings",
        icon: LifeBuoy,
        description: "Bookings placed on a customer's behalf by the support desk.",
      },
      {
        kind: "link",
        title: "Chat Interventions",
        url: "/admin/support/chat-interventions",
        icon: MessageSquare,
        description: "Moderation, safety, and escalation actions in customer-cleaner chats.",
      },
      {
        kind: "link",
        title: "Claim Reviews",
        url: "/admin/support/claim-reviews",
        icon: FileCheck,
        description: "Complaint and dispute claims, and their adjudication records.",
      },
      {
        kind: "link",
        title: "Service Credits",
        url: "/admin/support/service-credits",
        icon: Coins,
        description: "Service credit ledger entries and customer credit adjustments.",
      },
      {
        kind: "link",
        title: "Payout Adjustments",
        url: "/admin/support/payout-adjustments",
        icon: Wallet,
        description: "Manual cleaner payout correction records.",
      },
    ],
  },
  {
    kind: "group",
    title: "Comms & Governance",
    icon: Radio,
    description: "Announcements, cleaner tagging, and availability exceptions.",
    subItems: [
      {
        kind: "link",
        title: "Broadcasts",
        url: "/admin/governance/broadcasts",
        icon: Megaphone,
        description: "Platform-wide or targeted announcements and their dispatch state.",
      },
      {
        kind: "link",
        title: "Cleaner Tags",
        url: "/admin/governance/cleaner-tags",
        icon: Tags,
        description: "Cleaner skill, equipment and certification tags, and their verification.",
      },
      {
        kind: "link",
        title: "Availability Overrides",
        url: "/admin/governance/availability-overrides",
        icon: CalendarClock,
        description: "Temporary blocking and unblocking windows for cleaner availability.",
      },
    ],
  },
];

/**
 * Flattened `url -> description` view of `menuItems`, so the ⌘K palette can
 * label a destination with the same sentence its nav entry uses without keeping
 * a second copy of the strings. Groups are excluded: they have no route.
 */
const NAV_DESCRIPTIONS_BY_URL: Record<string, string> = Object.fromEntries(
  menuItems.flatMap((item) =>
    item.kind === "link"
      ? [[item.url, item.description] as const]
      : item.subItems.map((subItem) => [subItem.url, subItem.description] as const)
  )
);

/** `undefined` for a path the sidebar doesn't know about — callers just omit the subtitle. */
export function adminNavDescription(url: string): string | undefined {
  return NAV_DESCRIPTIONS_BY_URL[url];
}

/**
 * Tooltip body shared by every nav row: the label, plus the one-line description
 * under it. Collapsed, this is the only place the label exists at all; expanded,
 * it is the only place the description does.
 */
function NavTooltip({ title, description }: { title: string; description: string }) {
  return (
    <TooltipContent
      side="right"
      className="max-w-[15rem] border-0 bg-sidebar-active text-sidebar-active-foreground"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-sidebar-muted">{description}</p>
    </TooltipContent>
  );
}

export function AdminSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const { allowedRoutes, canAccessRoute, profileQuery } = useAdminAccess();
  const logout = useAdminLogout();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const alertsQuery = useQuery({
    queryKey: ["open-alert-attention-count"],
    queryFn: () => fetchAlerts({ status: "open", unreadOnly: true, skip: 0, limit: 99 }),
    refetchInterval: 30_000,
    enabled: canAccessRoute("/admin/security/alerts"),
  });
  const pendingElevationQuery = useQuery({
    queryKey: ["pending-elevation-request-count"],
    queryFn: () => listElevationRequests({ status: "PENDING", skip: 0, limit: 200 }),
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

  // `AdminOut` sends `firstName`/`lastName`; there is no `full_name` on the
  // wire, so the old fallback meant this always showed the email prefix.
  const displayName = useMemo(() => {
    const fullName = `${profileQuery.data?.firstName || ""} ${profileQuery.data?.lastName || ""}`.trim();
    if (fullName) return fullName;
    const email = profileQuery.data?.email?.trim();
    if (email) return email.split("@")[0] || "Admin";
    return "Admin";
  }, [profileQuery.data?.email, profileQuery.data?.firstName, profileQuery.data?.lastName]);

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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
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

      <SidebarSeparator className="bg-sidebar-group-border opacity-50 mb-2 mx-0" />

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
                {/* Instant when collapsed (the tooltip *is* the label); a beat
                    slower when expanded, where it only adds the description. */}
                <Tooltip delayDuration={collapsed ? 0 : 400}>
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
                  <NavTooltip title={item.title} description={item.description} />
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
                              <Tooltip key={sub.title} delayDuration={400}>
                                <TooltipTrigger asChild>
                                  <Link
                                    href={sub.url}
                                    className={cn(
                                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors duration-200 outline-none",
                                      "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",

                                      isSubActive && "bg-sidebar-primary/50 text-white",
                                      pendingNavigationHref === sub.url && "opacity-80 pointer-events-none"
                                    )}
                                    onClick={() => setPendingNavigationHref(sub.url)}
                                    onMouseEnter={() => void prefetchNavItem(queryClient, sub)}
                                    onFocus={() => void prefetchNavItem(queryClient, sub)}
                                  >
                                    <sub.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                                    <span className="flex-1">{sub.title}</span>
                                    {pendingNavigationHref === sub.url && (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    {sub.url === "/admin/security/alerts" && alertAttentionCount > 0 && (
                                      <Badge
                                        variant="destructive"
                                        className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-mono-data"
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
                                </TooltipTrigger>
                                <NavTooltip title={sub.title} description={sub.description} />
                              </Tooltip>
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

      <SidebarFooter className="mt-auto border-t border-sidebar-border p-4">
        <div className={cn("flex items-center gap-3 rounded-md mb-4", !collapsed && "")}>
          {/* Was a hard-coded slate hex, which had no dark-theme answer. The
              sidebar's own accent pair is theme-aware and already contrast-checked. */}
          <Avatar className="h-10 w-10 shrink-0 bg-sidebar-accent">
            <AvatarFallback className="bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
              {initials}
            </AvatarFallback>
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
