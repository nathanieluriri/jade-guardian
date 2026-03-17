import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  User,
  MapPin,
  Calendar,
  Briefcase,
  CreditCard,
  FileImage,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
} from "lucide-react";
import {
  type CleanerOnboarding,
  SERVICE_LABELS,
  EXPERIENCE_LABELS,
  DAY_LABELS,
} from "@/lib/mock-onboarding-data";

interface OnboardingDetailProps {
  cleaner: CleanerOnboarding;
  onBack: () => void;
  onDecision: (cleanerId: string, status: "APPROVED" | "REJECTED", reason?: string) => void;
}

const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="surface-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-label text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div>
      <span className="font-mono-data text-muted-foreground">{label}</span>
      <div className={`text-label ${warn ? "text-warning" : "text-foreground"}`}>
        {value || <span className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Missing</span>}
      </div>
    </div>
  );
}

export function OnboardingDetail({ cleaner, onBack, onDecision }: OnboardingDetailProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [checklist, setChecklist] = useState({
    identity: false,
    document: false,
    location: false,
    availability: false,
    payout: false,
  });

  const p = cleaner.profile;
  const isPending = cleaner.onboarding_status === "PENDING";
  const allChecked = Object.values(checklist).every(Boolean);

  const canApprove =
    allChecked &&
    !!p &&
    !!p.government_id_image_url &&
    !!p.payout_information &&
    !!p.location &&
    p.weekly_availability.days.length > 0 &&
    p.services.length > 0;

  const canReject = rejectionReason.trim().length >= 10;
  const rejectTemplates = [
    "Government ID image is unreadable. Upload a clearer image with all corners visible.",
    "Payout information is incomplete. Provide a valid account number and bank details.",
    "Service coverage and weekly availability are insufficient for approval.",
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight truncate">
              {cleaner.firstName} {cleaner.lastName}
            </h2>
            <Badge
              variant={
                cleaner.onboarding_status === "APPROVED" ? "success" :
                cleaner.onboarding_status === "REJECTED" ? "destructive" :
                "secondary"
              }
            >
              {cleaner.onboarding_status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="font-mono-data text-muted-foreground">
              Cleaner ID (source of truth): <span className="text-foreground">{cleaner.id}</span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={async () => {
                await navigator.clipboard.writeText(cleaner.id);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Previous rejection */}
      {cleaner.rejection_reason && (
        <div className="surface-card p-3 border-l-2 border-destructive">
          <span className="font-mono-data text-destructive font-medium">Previous Rejection</span>
          <p className="text-label text-foreground mt-1">{cleaner.rejection_reason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Identity */}
        <Section title="Identity" icon={User}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" value={cleaner.firstName} />
            <Field label="Last Name" value={cleaner.lastName} />
            <Field label="Email" value={cleaner.email} />
            <Field label="Created" value={new Date(cleaner.date_created).toLocaleString()} />
          </div>
        </Section>

        {/* Government ID */}
        <Section title="Government ID" icon={FileImage}>
          {p?.government_id_image_url ? (
            <div className="space-y-2">
              <div className="relative rounded-md overflow-hidden bg-muted aspect-video">
                <img
                  src={p.government_id_image_url}
                  alt="Government ID"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <a
                href={p.government_id_image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono-data text-primary flex items-center gap-1 hover:underline"
              >
                Open full size <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-destructive text-label py-4">
              <AlertTriangle className="h-4 w-4" />
              No government ID uploaded
            </div>
          )}
        </Section>

        {/* Location */}
        <Section title="Location & Service Radius" icon={MapPin}>
          {p?.location ? (
            <div className="space-y-2">
              <Field label="Address" value={p.location.place} />
              <Field label="Place ID" value={<span className="font-mono-data text-foreground">{p.location.place_id}</span>} />
              <Field label="Service Radius" value={`${p.location.service_radius_miles} miles`} />
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((p.location.service_radius_miles - 10) / 40) * 100}%` }}
                />
              </div>
              <div className="flex justify-between font-mono-data text-muted-foreground">
                <span>10 mi</span><span>50 mi</span>
              </div>
            </div>
          ) : (
            <div className="text-destructive text-label flex items-center gap-2 py-4">
              <AlertTriangle className="h-4 w-4" /> No location data
            </div>
          )}
        </Section>

        {/* Availability */}
        <Section title="Weekly Availability" icon={Calendar}>
          {p ? (
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map((day) => {
                const active = p.weekly_availability.days.includes(day);
                return (
                  <span
                    key={day}
                    className={`px-2.5 py-1 rounded-md text-label transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="text-destructive text-label flex items-center gap-2 py-4">
              <AlertTriangle className="h-4 w-4" /> No profile data
            </div>
          )}
        </Section>

        {/* Services & Experience */}
        <Section title="Services & Experience" icon={Briefcase}>
          {p ? (
            <div className="space-y-3">
              <Field label="Experience Level" value={
                <Badge variant="secondary">{EXPERIENCE_LABELS[p.experience_level]}</Badge>
              } />
              <div>
                <span className="font-mono-data text-muted-foreground">Services</span>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {p.services.map((s) => (
                    <Badge key={s} variant="outline">{SERVICE_LABELS[s] || s}</Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-destructive text-label flex items-center gap-2 py-4">
              <AlertTriangle className="h-4 w-4" /> No profile data
            </div>
          )}
        </Section>

        {/* Payout */}
        <Section title="Payout Information" icon={CreditCard}>
          {p?.payout_information ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Method" value={p.payout_information.method.replace("_", " ")} />
              <Field label="Account Holder" value={p.payout_information.account_holder_name} />
              <Field label="Routing" value={<span className="font-mono-data text-foreground">{p.payout_information.routing_number}</span>} />
              <Field label="Account (last 4)" value={<span className="font-mono-data text-foreground">····{p.payout_information.account_last_four}</span>} />
            </div>
          ) : (
            <div className="text-destructive text-label flex items-center gap-2 py-4">
              <AlertTriangle className="h-4 w-4" /> No payout information
            </div>
          )}
        </Section>
      </div>

      {/* Review History */}
      {cleaner.review_history.length > 0 && (
        <div className="surface-card p-4 space-y-2">
          <span className="text-label text-foreground">Review History</span>
          {cleaner.review_history.map((r, i) => (
            <div key={i} className="flex items-start gap-2 font-mono-data text-muted-foreground">
              {r.decision === "APPROVED" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              )}
              <span>
                <strong className="text-foreground">{r.reviewer_id}</strong> — {r.decision}
                {r.reason && <> — "{r.reason}"</>}
                <br />
                {new Date(r.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Review Checklist & Actions */}
      {isPending && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-card p-4 space-y-4"
        >
          <span className="text-label text-foreground">Review Checklist</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: "identity" as const, label: "Identity & profile completeness confirmed" },
              { key: "document" as const, label: "Government ID reviewed & readable" },
              { key: "location" as const, label: "Location & service radius reasonable" },
              { key: "availability" as const, label: "Availability & services checked" },
              { key: "payout" as const, label: "Payout info format complete" },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-label text-foreground cursor-pointer">
                <Checkbox
                  checked={checklist[item.key]}
                  onCheckedChange={(v) => setChecklist((prev) => ({ ...prev, [item.key]: !!v }))}
                />
                {item.label}
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => setShowApproveDialog(true)}
              disabled={!canApprove}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(true)}
              className="gap-1.5"
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>

          {!canApprove && allChecked && (
            <p className="font-mono-data text-destructive">
              Cannot approve: missing required profile data (document, payout, or profile).
            </p>
          )}
        </motion.div>
      )}

      {/* Approve Confirmation */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {cleaner.firstName} {cleaner.lastName}?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono-data">{cleaner.id}</span> will be approved for marketplace visibility. This action is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDecision(cleaner.id, "APPROVED")}>
              Confirm Approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={(open) => {
        setShowRejectDialog(open);
        if (!open) setRejectionReason("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {cleaner.firstName} {cleaner.lastName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a clear, actionable reason so the cleaner can fix and resubmit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Rejection reason (min 10 characters)..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="mt-2"
            rows={3}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {rejectTemplates.map((template) => (
              <Button
                key={template}
                variant="outline"
                size="sm"
                onClick={() => setRejectionReason(template)}
                className="text-left whitespace-normal h-auto"
              >
                {template}
              </Button>
            ))}
          </div>
          {rejectionReason.length > 0 && rejectionReason.length < 10 && (
            <p className="font-mono-data text-destructive">Reason must be at least 10 characters.</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canReject}
              onClick={() => onDecision(cleaner.id, "REJECTED", rejectionReason)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
