"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fetchCleanerById, listOnboardingQueue, reviewCleanerOnboarding } from "@/lib/api/admin-api";
import { OnboardingQueue } from "@/components/OnboardingQueue";
import { OnboardingDetail } from "@/components/OnboardingDetail";
import { computeOnboardingStats, mapCleanerToOnboarding, type CleanerOnboarding } from "@/lib/mock-onboarding-data";

function resolveCleanerId(input: { id?: string; _id?: string }): string {
  return input.id || input._id || "";
}

export default function CleanerOnboardingPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [search, setSearch] = useState("");
  const [start, setStart] = useState(0);
  const [stop, setStop] = useState(20);
  const [selectedCleanerId, setSelectedCleanerId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Array<{ cleanerId: string; decision: "APPROVED" | "REJECTED"; at: string }>>([]);

  const cleanersQuery = useQuery({
    queryKey: ["admin-cleaners", { status, search, start, stop }],
    queryFn: () => listOnboardingQueue(start, stop, "submitted_at"),
  });

  const normalizedCleaners = useMemo(() => {
    const items = (cleanersQuery.data || []).map((cleaner) => {
      const resolvedId = resolveCleanerId(cleaner);
      return mapCleanerToOnboarding({
        ...cleaner,
        id: resolvedId,
        profile: cleaner.profile as never,
      });
    });

    const filtered = items.filter((cleaner) => {
      if (status !== "ALL" && cleaner.onboarding_status !== status) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return (
        cleaner.id.toLowerCase().includes(query) ||
        cleaner.firstName.toLowerCase().includes(query) ||
        cleaner.lastName.toLowerCase().includes(query) ||
        cleaner.email.toLowerCase().includes(query)
      );
    });

    return filtered;
  }, [cleanersQuery.data, search, status]);

  useEffect(() => {
    if (!normalizedCleaners.length) {
      setSelectedCleanerId(null);
      return;
    }

    if (!selectedCleanerId || !normalizedCleaners.some((item) => item.id === selectedCleanerId)) {
      setSelectedCleanerId(normalizedCleaners[0].id);
    }
  }, [normalizedCleaners, selectedCleanerId]);

  const selectedCleaner = useMemo<CleanerOnboarding | null>(() => {
    if (!selectedCleanerId) return null;
    return normalizedCleaners.find((item) => item.id === selectedCleanerId) || null;
  }, [normalizedCleaners, selectedCleanerId]);

  const cleanerDetailQuery = useQuery({
    queryKey: ["admin-cleaner-detail", selectedCleanerId],
    enabled: !!selectedCleanerId,
    queryFn: async () => {
      if (!selectedCleanerId) return null;
      const cleaner = await fetchCleanerById(selectedCleanerId);
      const resolvedId = resolveCleanerId(cleaner);
      return mapCleanerToOnboarding({ ...cleaner, id: resolvedId, profile: cleaner.profile as never });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ cleanerId, nextStatus, reason }: { cleanerId: string; nextStatus: "APPROVED" | "REJECTED"; reason?: string }) =>
      reviewCleanerOnboarding(cleanerId, nextStatus, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-cleaners"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cleaner-detail", variables.cleanerId] });
      setTimeline((prev) => [{ cleanerId: variables.cleanerId, decision: variables.nextStatus, at: new Date().toISOString() }, ...prev]);

      const nextPending = normalizedCleaners.find((item) => item.id !== variables.cleanerId && item.onboarding_status === "PENDING");
      if (nextPending) {
        setSelectedCleanerId(nextPending.id);
      }

      toast.success(`Cleaner ${variables.cleanerId} ${variables.nextStatus.toLowerCase()} successfully.`);
    },
    onError: () => {
      toast.error("Failed to submit onboarding decision.");
    },
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;
      if (!selectedCleaner) return;

      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        const index = normalizedCleaners.findIndex((item) => item.id === selectedCleaner.id);
        const next = normalizedCleaners[Math.min(index + 1, normalizedCleaners.length - 1)];
        if (next) setSelectedCleanerId(next.id);
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        const index = normalizedCleaners.findIndex((item) => item.id === selectedCleaner.id);
        const prev = normalizedCleaners[Math.max(index - 1, 0)];
        if (prev) setSelectedCleanerId(prev.id);
      }

      if (event.key.toLowerCase() === "a" && selectedCleaner.onboarding_status === "PENDING") {
        event.preventDefault();
        reviewMutation.mutate({ cleanerId: selectedCleaner.id, nextStatus: "APPROVED" });
      }

      if (event.key.toLowerCase() === "r" && selectedCleaner.onboarding_status === "PENDING") {
        event.preventDefault();
        toast.info("Use the reject dialog to pick a reason template before submitting.");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [normalizedCleaners, reviewMutation, selectedCleaner]);

  const stats = useMemo(() => computeOnboardingStats(normalizedCleaners), [normalizedCleaners]);

  return (
    <div className="space-y-5 max-w-[1300px]">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tighter">Cleaner Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Workflow shortcuts: <span className="font-mono-data">J/K</span> navigate queue, <span className="font-mono-data">A</span> approve.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "PENDING" | "APPROVED" | "REJECTED" | "ALL")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search cleaner"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <button
            onClick={() => {
              const nextStart = start + stop;
              setStart(nextStart);
            }}
            className="h-9 rounded-md border border-input px-3 text-sm"
          >
            Next page
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4">
        <div className="space-y-3">
          {cleanersQuery.isLoading && <p className="font-mono-data text-muted-foreground">Loading onboarding queue...</p>}
          {cleanersQuery.isError && <p className="font-mono-data text-destructive">Failed to load onboarding queue.</p>}
          {!cleanersQuery.isLoading && !cleanersQuery.isError && (
            <OnboardingQueue cleaners={normalizedCleaners} stats={stats} onSelect={(cleaner) => setSelectedCleanerId(cleaner.id)} />
          )}
        </div>

        <div className="space-y-4">
          {!selectedCleaner && (
            <div className="surface-card p-8">
              <p className="text-muted-foreground">Select a cleaner from the queue to review details.</p>
            </div>
          )}

          {selectedCleaner && (
            <OnboardingDetail
              cleaner={cleanerDetailQuery.data || selectedCleaner}
              onBack={() => setSelectedCleanerId(null)}
              onDecision={(cleanerId, nextStatus, reason) =>
                reviewMutation.mutate({ cleanerId, nextStatus, reason })
              }
            />
          )}

          <div className="surface-card p-4">
            <h3 className="text-label text-muted-foreground mb-2">Session Timeline</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decisions submitted in this session.</p>
            ) : (
              <div className="space-y-2">
                {timeline.map((item) => (
                  <p key={`${item.cleanerId}-${item.at}`} className="font-mono-data text-sm">
                    {item.cleanerId} - {item.decision} - {new Date(item.at).toLocaleString()}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
