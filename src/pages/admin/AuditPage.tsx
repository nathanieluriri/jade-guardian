import { mockAuditEvents } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const severityToBadge: Record<string, "info" | "warning" | "high" | "critical"> = {
  info: "info",
  warning: "warning",
  high: "high",
  critical: "critical",
};

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.25, ease: [0.2, 0, 0, 1] as const },
  }),
};

export default function AuditPage() {
  return (
    <div className="space-y-5 max-w-[1200px]">
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-semibold tracking-tighter"
      >
        Audit Log
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="surface-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-label">Event</TableHead>
                <TableHead className="text-label">Severity</TableHead>
                <TableHead className="text-label hidden sm:table-cell">Actor</TableHead>
                <TableHead className="text-label hidden md:table-cell">Endpoint</TableHead>
                <TableHead className="text-label">Status</TableHead>
                <TableHead className="text-label hidden lg:table-cell">IP / Location</TableHead>
                <TableHead className="text-label">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAuditEvents.map((evt, i) => (
                <motion.tr
                  key={evt.id}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                  className="border-b border-border hover:bg-accent/30 transition-colors duration-150"
                >
                  <TableCell className="font-mono-data">{evt.event_type}</TableCell>
                  <TableCell>
                    <Badge variant={severityToBadge[evt.severity] || "secondary"} className="text-[10px]">
                      {evt.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono-data text-muted-foreground hidden sm:table-cell">{evt.actor.actor_email}</TableCell>
                  <TableCell className="font-mono-data hidden md:table-cell">{evt.request.method} {evt.request.path}</TableCell>
                  <TableCell className="font-mono-data">{evt.status_code}</TableCell>
                  <TableCell className="font-mono-data text-muted-foreground hidden lg:table-cell">
                    {evt.request.ip}
                    <br />
                    <span className="text-muted-foreground">{evt.request.geo_hint}</span>
                  </TableCell>
                  <TableCell className="font-mono-data text-muted-foreground">
                    {new Date(evt.date_created * 1000).toLocaleTimeString()}
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
}
