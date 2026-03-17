"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Monitor, Shield, Users, UserCog, Dot } from "lucide-react";
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
import { fetchAlerts } from "@/lib/api/admin-api";
import { Badge } from "@/components/ui/badge";

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
  const router = useRouter();
  const alertsQuery = useQuery({
    queryKey: ["command-alerts"],
    queryFn: () => fetchAlerts({ start: 0, stop: 6 }),
    staleTime: 30_000,
  });

  const alerts = useMemo(() => alertsQuery.data || [], [alertsQuery.data]);
  const unreadCount = useMemo(() => alerts.filter((item) => !item.is_read).length, [alerts]);
  const unackCount = useMemo(() => alerts.filter((item) => !item.ack_owner_id).length, [alerts]);

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

          <CommandGroup heading="Alerts">
            <div className="px-2 pb-2 flex items-center gap-2">
              <Badge variant="info">{unreadCount} unread</Badge>
              <Badge variant="warning">{unackCount} unacknowledged</Badge>
            </div>
            {alerts.map((alert) => (
              <CommandItem
                key={alert._id}
                onSelect={() => {
                  router.push("/admin/security/alerts");
                  setOpen(false);
                }}
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
                  {!alert.is_read && <Dot className="h-5 w-5 text-sky-600" />}
                  {!alert.ack_owner_id && <span className="font-mono-data">unack</span>}
                  <span title={new Date(alert.last_fired_at * 1000).toISOString()}>{formatRelativeTime(alert.last_fired_at)}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Quick Navigation">
            {[
              { label: "Overview", path: "/admin/overview", icon: Monitor },
              { label: "Sessions", path: "/admin/security/sessions", icon: Monitor },
              { label: "Permissions", path: "/admin/permissions/catalog", icon: Shield },
              { label: "Team", path: "/admin/team", icon: UserCog },
              { label: "Users", path: "/admin/users", icon: Users },
            ].map((item) => (
              <CommandItem
                key={item.path}
                onSelect={() => {
                  router.push(item.path);
                  setOpen(false);
                }}
              >
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
