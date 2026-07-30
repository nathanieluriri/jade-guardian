"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, Monitor, Shield, Users, UserCog, Dot, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { fetchAlerts, listElevationRequests } from "@/lib/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { useAdminAccess } from "@/hooks/use-admin-access";

function formatRelativeTime(epochSeconds: number) {
  const delta = Math.round((epochSeconds * 1000 - Date.now()) / 1000);
  const abs = Math.abs(delta);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(delta), "second");
  if (abs < 3600) return rtf.format(Math.round(delta / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(delta / 3600), "hour");
  return rtf.format(Math.round(delta / 86400), "day");
}

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { allowedRoutes, canAccessRoute } = useAdminAccess();
  const alertsQuery = useQuery({
    queryKey: ["command-alerts"],
    queryFn: () => fetchAlerts({ skip: 0, limit: 6 }),
    staleTime: 30_000,
    enabled: canAccessRoute("/admin/security/alerts"),
  });
  const pendingElevationQuery = useQuery({
    queryKey: ["pending-elevation-request-count"],
    queryFn: () => listElevationRequests({ status: "PENDING", skip: 0, limit: 200 }),
    staleTime: 30_000,
    enabled: canAccessRoute("/admin/access/requests"),
  });

  const alerts = useMemo(() => alertsQuery.data || [], [alertsQuery.data]);
  const unreadCount = useMemo(() => alerts.filter((item) => !item.is_read).length, [alerts]);
  const unackCount = useMemo(() => alerts.filter((item) => !item.ack_owner_id).length, [alerts]);
  const pendingElevationCount = pendingElevationQuery.data?.length || 0;
  const quickNavigationItems = useMemo(
    () =>
      [
        { label: "Overview", path: "/admin/overview", icon: Monitor },
        { label: "Sessions", path: "/admin/security/sessions", icon: Monitor },
        { label: "Permissions", path: "/admin/permissions/catalog", icon: Shield },
        { label: "Team", path: "/admin/team", icon: UserCog },
        { label: "Users", path: "/admin/users", icon: Users },
        { label: "Service Definitions", path: "/admin/operations/service-definitions", icon: Shield },
        { label: "Promo Codes", path: "/admin/operations/promo-codes", icon: Shield },
        { label: "Concierge Bookings", path: "/admin/support/concierge-bookings", icon: Shield },
        { label: "Claim Reviews", path: "/admin/support/claim-reviews", icon: Shield },
        { label: "Broadcasts", path: "/admin/governance/broadcasts", icon: Shield },
        { label: "Availability Overrides", path: "/admin/governance/availability-overrides", icon: Shield },
        { label: "Access Hub", path: "/admin/access", icon: Shield },
        { label: "Access Requests", path: "/admin/access/requests", icon: Shield },
      ].filter((item) => allowedRoutes.has(item.path)),
    [allowedRoutes]
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (pendingPath && pathname === pendingPath) {
      setPendingPath(null);
      setOpen(false);
    }
  }, [pathname, pendingPath]);

  const handleNavigate = (path: string) => {
    if (pendingPath) return;
    if (path === pathname) {
      setOpen(false);
      return;
    }
    setPendingPath(path);
    router.push(path);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border/50 bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-border transition-colors min-w-[170px] justify-between"
      >
        <span className="inline-flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search alerts...</span>
        </span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted px-1.5 font-mono-data text-[10px] text-muted-foreground">
          Ctrl+K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search alerts or navigate..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {allowedRoutes.has("/admin/security/alerts") && (
            <>
              <CommandGroup heading="Alerts">
                <div className="px-2 pb-2 flex items-center gap-2">
                  <Badge variant="info">{unreadCount} unread</Badge>
                  <Badge variant="warning">{unackCount} unacknowledged</Badge>
                </div>
                {alerts.map((alert) => (
                  <CommandItem
                    key={alert._id}
                    onSelect={() => handleNavigate("/admin/security/alerts")}
                  >
                    <Bell className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <span className={["truncate text-sm", alert.is_read ? "font-medium" : "font-semibold"].join(" ")}>
                        {alert.title}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono-data truncate">
                        {alert.source_ip && `IP: ${alert.source_ip}`}
                        {alert.affected_user && ` · User: ${alert.affected_user}`}
                      </span>
                    </div>
                    <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      {pendingPath === "/admin/security/alerts" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {!alert.is_read && <Dot className="h-5 w-5 text-sky-600" />}
                      {!alert.ack_owner_id && <span className="font-mono-data">unack</span>}
                      <span title={new Date(alert.last_fired_at * 1000).toISOString()}>{formatRelativeTime(alert.last_fired_at)}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Quick Navigation">
            {quickNavigationItems.map((item) => (
              <CommandItem
                key={item.path}
                onSelect={() => handleNavigate(item.path)}
              >
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
                {item.path === "/admin/access/requests" && pendingElevationCount > 0 && (
                  <Badge variant="warning" className="ml-auto mr-1 h-5 min-w-5 px-1.5 text-[10px] font-mono-data">
                    {pendingElevationCount > 99 ? "99+" : pendingElevationCount}
                  </Badge>
                )}
                {pendingPath === item.path && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
