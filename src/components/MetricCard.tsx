import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: number | string;
  variant?: "default" | "danger" | "success";
  suffix?: ReactNode;
}

export function MetricCard({ label, value, variant = "default", suffix }: MetricCardProps) {
  const valueColor =
    variant === "danger"
      ? "text-destructive"
      : variant === "success"
      ? "text-primary"
      : "text-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="surface-card surface-card-hover p-4"
    >
      <p className="text-label text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tracking-tighter tabular-nums ${valueColor}`}>
          {value}
        </span>
        {suffix}
      </div>
    </motion.div>
  );
}
