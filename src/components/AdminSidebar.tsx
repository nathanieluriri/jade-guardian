import { useState } from "react";
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
  Settings,
  HelpCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const sections = [
  {
    label: "Monitoring",
    items: [
      { title: "Overview", url: "/admin/overview", icon: LayoutDashboard },
      { title: "Alerts", url: "/admin/security/alerts", icon: Bell },
      { title: "Sessions", url: "/admin/security/sessions", icon: Monitor },
      { title: "Audit Log", url: "/admin/security/audit", icon: FileSearch },
    ],
  },
  {
    label: "Governance",
    items: [
      { title: "Permission Catalog", url: "/admin/permissions/catalog", icon: Key },
      { title: "Role Templates", url: "/admin/permissions/templates", icon: Users },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Cleaner Onboarding", url: "/admin/onboarding/cleaners", icon: UserCheck },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.label, true]))
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{ borderRight: "1px solid hsl(var(--sidebar-border))" }}
    >
      {/* Header */}
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-[18px] w-[18px] text-primary-foreground" strokeWidth={2} />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
              Sentinel
            </span>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2 scrollbar-thin">
        {sections.map((section, idx) => {
          const isOpen = openGroups[section.label];
          return (
            <div key={section.label}>
              {idx > 0 && (
                <SidebarSeparator className="mx-3 my-1 bg-[hsl(var(--sidebar-group-border))]" />
              )}
              <SidebarGroup className="py-1">
                {!collapsed && (
                  <SidebarGroupLabel
                    className="mb-1 cursor-pointer select-none px-3 text-[11px] uppercase tracking-[0.1em] font-semibold text-[hsl(var(--sidebar-muted))] hover:text-sidebar-foreground transition-colors"
                    onClick={() => toggleGroup(section.label)}
                  >
                    <span className="flex-1">{section.label}</span>
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isOpen && "rotate-90"
                      )}
                    />
                  </SidebarGroupLabel>
                )}
                {(collapsed || isOpen) && (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <SidebarMenuItem key={item.title}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuButton asChild>
                                  <NavLink
                                    to={item.url}
                                    end
                                    className={cn(
                                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors duration-150",
                                      "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                      isActive &&
                                        "bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-active-foreground))] hover:bg-[hsl(var(--sidebar-active))] hover:text-[hsl(var(--sidebar-active-foreground))]"
                                    )}
                                    activeClassName=""
                                  >
                                    {isActive && (
                                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[hsl(var(--sidebar-active-foreground))]" />
                                    )}
                                    <item.icon
                                      className="h-5 w-5 shrink-0"
                                      strokeWidth={1.75}
                                    />
                                    {!collapsed && <span>{item.title}</span>}
                                  </NavLink>
                                </SidebarMenuButton>
                              </TooltipTrigger>
                              {collapsed && (
                                <TooltipContent
                                  side="right"
                                  className="bg-[hsl(142,72%,29%)] text-[hsl(0,0%,100%)] border-0 text-xs font-medium px-3 py-1.5"
                                >
                                  {item.title}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            </div>
          );
        })}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="mt-auto border-t border-[hsl(var(--sidebar-border))] px-3 py-3">
        {/* Settings & Help */}
        {!collapsed ? (
          <div className="flex items-center gap-1 mb-3">
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
              <Settings className="h-4 w-4" strokeWidth={1.75} />
              <span>Settings</span>
            </button>
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
              <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
              <span>Help</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 mb-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                  <Settings className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[hsl(142,72%,29%)] text-[hsl(0,0%,100%)] border-0 text-xs font-medium px-3 py-1.5">
                Settings
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                  <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[hsl(142,72%,29%)] text-[hsl(0,0%,100%)] border-0 text-xs font-medium px-3 py-1.5">
                Help
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* User card */}
        <div className={cn(
          "flex items-center gap-3 rounded-md",
          !collapsed && "px-2 py-2"
        )}>
          <Avatar className="h-8 w-8 shrink-0 border border-[hsl(var(--sidebar-border))]">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-semibold">
              SA
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-semibold text-sidebar-foreground truncate">
                Sarah Admin
              </span>
              <span className="text-[11px] text-[hsl(var(--sidebar-muted))] truncate">
                sarah@sentinel.io
              </span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
