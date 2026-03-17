"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Monitor, Shield } from "lucide-react";
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

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const alertsQuery = useQuery({
    queryKey: ["command-alerts"],
    queryFn: () => fetchAlerts({ start: 0, stop: 6 }),
    staleTime: 30_000,
  });

  const alerts = useMemo(() => alertsQuery.data || [], [alertsQuery.data]);

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
        className="flex items-center gap-2 rounded-md border border-border/50 bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-border transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted px-1.5 font-mono-data text-[10px] text-muted-foreground">
          Ctrl+K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search alerts or navigate..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Alerts">
            {alerts.map((alert) => (
              <CommandItem
                key={alert._id}
                onSelect={() => {
                  router.push("/admin/security/alerts");
                  setOpen(false);
                }}
              >
                <Bell className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">{alert.title}</span>
                  <span className="text-xs text-muted-foreground font-mono-data">
                    {alert.source_ip && `IP: ${alert.source_ip}`}
                    {alert.affected_user && ` · User: ${alert.affected_user}`}
                  </span>
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
