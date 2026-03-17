"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import { type CleanerOnboarding, type OnboardingStatus } from "@/lib/mock-onboarding-data";

interface OnboardingQueueProps {
  cleaners: CleanerOnboarding[];
  stats: {
    total_pending: number;
    total_approved_today: number;
    total_rejected_today: number;
    avg_review_time_minutes: number;
  };
  onSelect: (cleaner: CleanerOnboarding) => void;
}

const statusBadgeVariant = (status: OnboardingStatus) => {
  switch (status) {
    case "APPROVED":
      return "success" as const;
    case "REJECTED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.25, ease: [0.2, 0, 0, 1] as const },
  }),
};

export function OnboardingQueue({ cleaners, stats, onSelect }: OnboardingQueueProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filtered = cleaners.filter((c) => {
    if (statusFilter !== "ALL" && c.onboarding_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending", value: stats.total_pending, icon: Clock, color: "text-muted-foreground" },
          { label: "Approved Today", value: stats.total_approved_today, icon: CheckCircle, color: "text-primary" },
          { label: "Rejected Today", value: stats.total_rejected_today, icon: XCircle, color: "text-destructive" },
          { label: "Avg Review", value: `${stats.avg_review_time_minutes}m`, icon: Clock, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="surface-card px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              <span className="font-mono-data text-muted-foreground">{s.label}</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card divide-y divide-border">
        {filtered.length === 0 && <div className="px-4 py-8 text-center text-muted-foreground font-mono-data">No cleaners match your filters.</div>}
        {filtered.map((cleaner, i) => {
          const hasFlags = cleaner.flags.missing_profile || cleaner.flags.missing_document || cleaner.flags.missing_payout;
          return (
            <motion.button
              key={cleaner.id}
              custom={i}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              onClick={() => onSelect(cleaner)}
              className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2 hover:bg-accent/50 transition-colors duration-150 text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-label text-foreground truncate">
                    {cleaner.firstName} {cleaner.lastName}
                  </span>
                  {hasFlags && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                </div>
                <p className="font-mono-data text-muted-foreground truncate">
                  {cleaner.id} · {cleaner.email} · {new Date(cleaner.date_created).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasFlags && (
                  <span className="font-mono-data text-warning">
                    {[
                      cleaner.flags.missing_profile && "No profile",
                      cleaner.flags.missing_document && "No ID",
                      cleaner.flags.missing_payout && "No payout",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                <Badge variant={statusBadgeVariant(cleaner.onboarding_status)}>{cleaner.onboarding_status}</Badge>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
