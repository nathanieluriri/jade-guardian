import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Monitor, FileSearch, Shield } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { mockAlerts, mockAuditEvents } from "@/lib/mock-data";

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted px-1.5 font-mono-data text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search alerts, IPs, users, events…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Alerts">
            {mockAlerts.slice(0, 4).map((alert) => (
              <CommandItem
                key={alert._id}
                onSelect={() => {
                  navigate("/admin/security/alerts");
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

          <CommandGroup heading="Audit Events">
            {mockAuditEvents.slice(0, 3).map((evt) => (
              <CommandItem
                key={evt.id}
                onSelect={() => {
                  navigate("/admin/security/audit");
                  setOpen(false);
                }}
              >
                <FileSearch className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">{evt.event_type.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground font-mono-data">
                    IP: {evt.request.ip} · {evt.request.geo_hint}
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
                  navigate(item.path);
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
