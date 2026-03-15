import { mockDeniedPermissions } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: [0.2, 0, 0, 1] as const },
  }),
};

export default function PermissionCatalogPage() {
  return (
    <div className="space-y-5 max-w-[1000px]">
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-semibold tracking-tighter"
      >
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
          {mockDeniedPermissions.items.map((item, i) => (
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
                    <span key={a} className="font-mono-data text-muted-foreground">{a}</span>
                  ))}
                </div>
              </div>
              <Badge variant={item.deny_count > 10 ? "high" : "warning"}>
                {item.deny_count} denied
              </Badge>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
