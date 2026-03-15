import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { OnboardingQueue } from "@/components/OnboardingQueue";
import { OnboardingDetail } from "@/components/OnboardingDetail";
import { mockOnboardingCleaners, type CleanerOnboarding } from "@/lib/mock-onboarding-data";

export default function CleanerOnboardingPage() {
  const [cleaners, setCleaners] = useState(mockOnboardingCleaners);
  const [selected, setSelected] = useState<CleanerOnboarding | null>(null);

  const handleDecision = (cleanerId: string, status: "APPROVED" | "REJECTED", reason?: string) => {
    // In production: PATCH /v1/admins/cleaners/{cleaner_id}/onboarding-review
    setCleaners((prev) =>
      prev.map((c) =>
        c.id === cleanerId
          ? {
              ...c,
              onboarding_status: status,
              rejection_reason: status === "REJECTED" ? (reason || null) : c.rejection_reason,
              review_history: [
                ...c.review_history,
                {
                  reviewer_id: "admin_001",
                  decision: status,
                  reason: reason || null,
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : c
      )
    );

    setSelected(null);

    if (status === "APPROVED") {
      toast.success(`${cleanerId} approved for marketplace visibility.`);
    } else {
      toast.info(`${cleanerId} rejected. Cleaner must update and resubmit.`);
    }
  };

  return (
    <div className="max-w-[1100px]">
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-semibold tracking-tighter mb-5"
      >
        Cleaner Onboarding
      </motion.h1>

      {selected ? (
        <OnboardingDetail
          cleaner={selected}
          onBack={() => setSelected(null)}
          onDecision={handleDecision}
        />
      ) : (
        <OnboardingQueue cleaners={cleaners} onSelect={setSelected} />
      )}
    </div>
  );
}
