import {
  Shield,
  LayoutDashboard,
  Bell,
  Monitor,
  FileSearch,
  Key,
  Users,
  UserCheck,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

  return (
    <Sidebar collapsible="icon" className="border-r-0" style={{ boxShadow: "inset -1px 0 0 0 hsl(var(--border))" }}>
      <SidebarContent className="bg-background">
        {/* Logo area */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              Sentinel Admin
            </span>
          )}
        </div>

        {sections.map((section) => (
          <Collapsible key={section.label} defaultOpen={true}>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="flex items-center justify-between cursor-pointer text-muted-foreground text-[11px] uppercase tracking-widest font-medium">
                  {!collapsed && section.label}
                  {!collapsed && <ChevronDown className="h-3 w-3" />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end
                            className="text-label text-muted-foreground hover:bg-accent rounded-md transition-colors duration-150"
                            activeClassName="bg-accent text-accent-foreground font-semibold"
                          >
                            <item.icon className="mr-2 h-4 w-4 shrink-0" />
                            {!collapsed && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
