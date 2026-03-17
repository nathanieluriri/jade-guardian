"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { fetchDeniedPermissions, fetchPermissionCatalog } from "@/lib/api/admin-api";

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: [0.2, 0, 0, 1] as const },
  }),
};

export default function PermissionCatalogPage() {
  const deniedQuery = useQuery({
    queryKey: ["permissions", "denied-top"],
    queryFn: () => fetchDeniedPermissions(24, 10),
  });
  const catalogQuery = useQuery({
    queryKey: ["permissions", "catalog"],
    queryFn: fetchPermissionCatalog,
  });

  const denied = deniedQuery.data || [];
  const catalog = catalogQuery.data;

  return (
    <div className="space-y-5 max-w-[1000px]">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tighter">
        Permission Catalog
      </motion.h1>

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
                <div className="mt-0.5 flex gap-1">
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

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card p-4 space-y-3">
        <h3 className="text-label text-muted-foreground">Catalog Snapshot</h3>
        {catalogQuery.isLoading && <p className="font-mono-data text-muted-foreground">Loading permission catalog...</p>}
        {catalogQuery.isError && <p className="font-mono-data text-destructive">Failed to load permission catalog.</p>}
        {!!catalog?.grouped?.length && (
          <div className="flex flex-wrap gap-2">
            {catalog.grouped.map((group) => (
              <Badge key={group.resource} variant="secondary">
                {group.resource}: {group.routes.length}
              </Badge>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
