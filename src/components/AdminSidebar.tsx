"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  LayoutDashboard,
  Bell,
  Monitor,
  FileSearch,
  Key,
  Users,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Settings,
  HelpCircle,
  Database,
  Store,
  Building2,
  Building,
  User,
  Activity,
  CreditCard,
  List,
  XCircle,
  Tag,
  Moon,
  LogOut,
  ChevronDown
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
import { fetchAlerts } from "@/lib/api/admin-api";
import { motion, AnimatePresence } from "framer-motion";

const menuItems = [
  { title: "Global Dashboard", url: "/admin/overview", icon: LayoutDashboard },
  { title: "Leads", url: "/admin/leads", icon: Database },
  { title: "Feature Marketplace", url: "/admin/marketplace", icon: Store },
  {
    title: "Institution Management",
    icon: Building2,
    subItems: [
      { title: "All Institutions", url: "/admin/institutions", icon: Building },
      { title: "User Management", url: "/admin/institutions/users", icon: User },
      { title: "Employees", url: "/admin/institutions/employees", icon: UserCheck },
      { title: "Personal Accounts", url: "/admin/institutions/personal", icon: User },
      { title: "Alerts", url: "/admin/security/alerts", icon: Bell },
    ],
  },
  { title: "Token Usage Analytics", url: "/admin/analytics", icon: Activity },
  {
    title: "Subscriptions",
    icon: CreditCard,
    subItems: [
      { title: "Plans", url: "/admin/subscriptions/plans", icon: CreditCard },
      { title: "All Subscriptions", url: "/admin/subscriptions/all", icon: List },
      { title: "Active & Paid Subscribers", url: "/admin/subscriptions/active", icon: UserCheck },
      { title: "Cancelled", url: "/admin/subscriptions/cancelled", icon: XCircle },
      { title: "Features", url: "/admin/subscriptions/features", icon: Tag },
    ],
  },
];

export function AdminSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const alertsQuery = useQuery({
    queryKey: ["open-alert-attention-count"],
    queryFn: () => fetchAlerts({ status: "open", unreadOnly: true, start: 0, stop: 99 }),
    refetchInterval: 30_000,
  });
  const alertAttentionCount = alertsQuery.data?.length || 0;
  
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    "Institution Management": true,
    "Subscriptions": true,
  });

  const toggleItem = (title: string, e: React.MouseEvent) => {
    e.preventDefault();
    setExpandedItems((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0" style={{ borderRight: "1px solid hsl(var(--sidebar-border))" }}>
      <SidebarHeader className="px-4 py-5 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white relative">
            <span className="text-[hsl(142,50%,12%)] font-bold text-xl tracking-tighter ml-[-2px]">T</span>
            <span className="text-[#30D5C8] font-bold text-xl absolute ml-[14px] mt-[4px]">.</span>
          </div>
          {!collapsed && <span className="text-2xl font-bold tracking-tight text-white">Traack</span>}
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
          {menuItems.map((item) => {
            const hasSub = !!item.subItems;
            const isExpanded = expandedItems[item.title];
            
            // Determine if parent or any child is active
            const isActive = pathname === item.url || (hasSub && item.subItems?.some(s => pathname === s.url));

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
                          isExpanded && "bg-sidebar-accent/50 text-white"
                        )}
                      >
                        <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.5} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">{item.title}</span>
                            <ChevronDown 
                              className={cn("h-4 w-4 shrink-0 transition-transform duration-200 text-sidebar-muted", isExpanded && "rotate-180")} 
                            />
                          </>
                        )}
                      </button>
                    ) : (
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.url!}
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors duration-200 outline-none",
                            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                            isActive && "bg-sidebar-active text-sidebar-active-foreground"
                          )}
                        >
                          <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.5} />
                          {!collapsed && <span>{item.title}</span>}
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
                          {item.subItems!.map((sub) => {
                            const isSubActive = pathname === sub.url;
                            return (
                              <Link
                                key={sub.title}
                                href={sub.url}
                                className={cn(
                                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors duration-200 outline-none",
                                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                                  isSubActive && "bg-sidebar-active text-sidebar-active-foreground shadow-sm"
                                )}
                              >
                                <sub.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                                <span className="flex-1">{sub.title}</span>
                                {sub.url === "/admin/security/alerts" && alertAttentionCount > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-mono-data bg-red-500 hover:bg-red-600 text-white border-0"
                                  >
                                    {alertAttentionCount > 99 ? "99+" : alertAttentionCount}
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
            <AvatarFallback className="bg-[#6d798a] text-white text-sm font-semibold">KO</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-semibold text-white truncate">KABRE Ousmane</span>
              <span className="text-[12px] text-sidebar-foreground truncate">okabre@traack.ai</span>
            </div>
          )}
        </div>

        {!collapsed ? (
          <div className="flex flex-col gap-1 w-full">
            <button className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors duration-200 outline-none">
              <Moon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
              <span>Dark Mode</span>
            </button>
            <button className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors duration-200 outline-none">
              <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.5} />
              <span>Log Out</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button className="rounded-xl p-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors duration-200 outline-none">
                  <Moon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-sidebar-active text-sidebar-active-foreground border-0 font-medium">
                Dark Mode
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button className="rounded-xl p-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors duration-200 outline-none">
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
