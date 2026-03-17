"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { RefreshCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchDeniedPermissions, fetchPermissionCatalog, fetchRoleTemplate } from "@/lib/api/admin-api";

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.25, ease: [0.2, 0, 0, 1] as const },
  }),
};

export default function PermissionCatalogPage() {
  const [search, setSearch] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(Date.now());

  const deniedQuery = useQuery({
    queryKey: ["permissions", "denied-top"],
    queryFn: () => fetchDeniedPermissions(24, 10),
  });
  const catalogQuery = useQuery({
    queryKey: ["permissions", "catalog"],
    queryFn: fetchPermissionCatalog,
  });
  const cleanerTemplateQuery = useQuery({ queryKey: ["role-template", "cleaner"], queryFn: () => fetchRoleTemplate("cleaner") });
  const customerTemplateQuery = useQuery({ queryKey: ["role-template", "customer"], queryFn: () => fetchRoleTemplate("customer") });

  const denied = deniedQuery.data || [];
  const catalog = catalogQuery.data;

  const usedKeys = useMemo(() => {
    const cleaner = cleanerTemplateQuery.data?.permissionList?.permissions || [];
    const customer = customerTemplateQuery.data?.permissionList?.permissions || [];
    return new Set([...cleaner, ...customer].map((permission) => permission.key));
  }, [cleanerTemplateQuery.data, customerTemplateQuery.data]);

  const searchText = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    const groups = catalog?.grouped || [];
    if (!searchText) return groups;

    return groups
      .map((group) => ({
        ...group,
        routes: group.routes.filter((route) => {
          const haystack = `${route.resource} ${route.method} ${route.path} ${route.key} ${route.summary || ""}`.toLowerCase();
          return haystack.includes(searchText);
        }),
      }))
      .filter((group) => group.routes.length > 0);
  }, [catalog?.grouped, searchText]);

  const stale = Date.now() - lastRefreshedAt > 60_000;

  return (
    <div className="space-y-5 max-w-[1200px]">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tighter">
        Permission Catalog
      </motion.h1>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-label text-muted-foreground">Endpoint Discovery</h3>
          <div className="flex items-center gap-2">
            {stale && <Badge variant="warning">Catalog cache may be stale</Badge>}
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={async () => {
                await catalogQuery.refetch();
                setLastRefreshedAt(Date.now());
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search resource, method, path, key, summary" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="surface-card"
      >
        <div className="p-4 border-b border-border">
          <h3 className="text-label text-muted-foreground">Top Denied Permissions (24h)</h3>
        </div>
        <div className="divide-y divide-border">
          {deniedQuery.isLoading && <p className="px-4 py-3 font-mono-data text-muted-foreground">Loading denied permissions...</p>}
          {deniedQuery.isError && <p className="px-4 py-3 font-mono-data text-destructive">Failed to load denied permissions.</p>}
          {denied.map((item, i) => (
            <motion.div
              key={item.permission_key}
              custom={i}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2 hover:bg-accent/50 transition-colors duration-150"
            >
              <div>
                <span className="font-mono-data text-foreground">{item.permission_key}</span>
                <div className="mt-0.5 flex gap-1 flex-wrap">
                  {item.admins.map((a) => (
                    <span key={a} className="font-mono-data text-muted-foreground">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <Badge variant={item.deny_count > 10 ? "high" : "warning"}>{item.deny_count} denied</Badge>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="space-y-4">
        {catalogQuery.isLoading && <p className="font-mono-data text-muted-foreground">Loading permission catalog...</p>}
        {catalogQuery.isError && <p className="font-mono-data text-destructive">Failed to load permission catalog.</p>}
        {!catalogQuery.isLoading && !catalogQuery.isError && filteredGroups.length === 0 && (
          <div className="surface-card p-8 text-center text-muted-foreground">No endpoints match your search.</div>
        )}

        {filteredGroups.map((group) => (
          <div key={group.resource} className="surface-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between gap-2">
              <h3 className="font-semibold capitalize">{group.resource}</h3>
              <Badge variant="secondary">{group.routes.length} endpoints</Badge>
            </div>
            <div className="divide-y divide-border">
              {group.routes.map((route) => (
                <div key={route.key} className="p-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono-data text-[10px]">{route.method}</Badge>
                      <span className="font-mono-data text-sm break-all">{route.path}</span>
                      {route.requires_auth && (
                        <Badge variant="info" className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Auth Required
                        </Badge>
                      )}
                      {usedKeys.has(route.key) && <Badge variant="success">Used in template</Badge>}
                    </div>
                    <p className="font-mono-data text-xs text-muted-foreground">Key: {route.key}</p>
                    <p className="text-sm text-muted-foreground">{route.summary || "No summary available for this endpoint."}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
