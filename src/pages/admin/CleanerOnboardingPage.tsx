import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

const mockCleaners = [
  { id: "cl_001", name: "Alice Johnson", email: "alice@example.com", status: "PENDING", submitted: "2026-03-14" },
  { id: "cl_002", name: "Bob Smith", email: "bob@example.com", status: "PENDING", submitted: "2026-03-13" },
  { id: "cl_003", name: "Carlos Rivera", email: "carlos@example.com", status: "APPROVED", submitted: "2026-03-12" },
  { id: "cl_004", name: "Dana Lee", email: "dana@example.com", status: "REJECTED", submitted: "2026-03-11" },
];

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: [0.2, 0, 0, 1] as const },
  }),
};

export default function CleanerOnboardingPage() {
  const [rejectionReason, setRejectionReason] = useState("");

  return (
    <div className="space-y-5 max-w-[1000px]">
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-semibold tracking-tighter"
      >
        Cleaner Onboarding Queue
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="surface-card"
      >
        <div className="divide-y divide-border">
          {mockCleaners.map((cleaner, i) => (
            <motion.div
              key={cleaner.id}
              custom={i}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3 hover:bg-accent/50 transition-colors duration-150"
            >
              <div>
                <span className="text-label text-foreground">{cleaner.name}</span>
                <p className="font-mono-data text-muted-foreground">{cleaner.email} · Submitted {cleaner.submitted}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    cleaner.status === "APPROVED" ? "success" :
                    cleaner.status === "REJECTED" ? "destructive" :
                    "secondary"
                  }
                >
                  {cleaner.status}
                </Badge>
                {cleaner.status === "PENDING" && (
                  <>
                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button size="sm" variant="default">Approve</Button>
                    </motion.div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <motion.div whileTap={{ scale: 0.97 }}>
                          <Button size="sm" variant="outline">Reject</Button>
                        </motion.div>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reject {cleaner.name}</AlertDialogTitle>
                          <AlertDialogDescription>
                            A rejection reason is mandatory for audit compliance.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Textarea
                          placeholder="Rejection reason (required)..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="mt-2"
                        />
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={!rejectionReason.trim()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirm Rejection
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
