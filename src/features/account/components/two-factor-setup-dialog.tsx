"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { AuthErrorPill } from "@/components/auth/auth-primitives";
import { ADMIN_PROFILE_QUERY_KEY } from "@/hooks/use-admin-auth";
import { setupTotp, verifyTotp } from "@/lib/api/admin-api";
import { adminAuthErrorCopy } from "@/lib/api/auth-errors";
import type { ApiError } from "@/lib/api/types";

/** Authenticator codes are always 6 digits; the field auto-submits on the sixth. */
const TOTP_CODE_LENGTH = 6;

/**
 * A "current code" proof may be either a 6-digit TOTP or one of the 10-character
 * base32 backup codes (`BACKUP_CODE_LENGTH` in the backend's
 * `admin-totp-service.ts`), so the field is free text capped at the longer one.
 */
export const PROOF_CODE_MAX_LENGTH = 10;

export type TwoFactorSetupStep = "init" | "scan" | "verify" | "backup" | "done";

/**
 * Whitespace is the only thing stripped: the backend hashes `code.trim()` and
 * compares case-sensitively, so re-casing a pasted backup code would break it.
 */
function normalizeProofCode(value: string): string {
  return value.replace(/\s+/g, "");
}

async function writeToClipboard(text: string): Promise<boolean> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadTextFile(filename: string, content: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

function backupCodesFileBody(codes: string[]): string {
  return [
    "Cleanm admin — two-factor backup codes",
    "======================================",
    "",
    "Each code works once. Keep them somewhere only you can reach.",
    "They cannot be shown again — regenerate from Account Security if you lose them.",
    "",
    ...codes.map((code, index) => `${index + 1}. ${code}`),
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
  ].join("\n");
}

/**
 * Copy control whose accessible name stays fixed while the icon/label flip to a
 * confirmed state, so the button never moves under a screen reader mid-flow.
 */
function CopyButton({
  label,
  value,
  variant = "outline",
  className,
}: {
  label: string;
  value: string;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2_000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function onCopy() {
    const ok = await writeToClipboard(value);
    setCopied(ok);
    if (ok) {
      toast.success("Copied to your clipboard.");
    } else {
      toast.error("Clipboard blocked — select the text and copy it manually.");
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      aria-label={label}
      className={className}
      onClick={() => void onCopy()}
    >
      {copied ? (
        <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}

export interface BackupCodesRevealProps {
  codes: string[];
  acknowledged: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
  /** Unique per host so two reveals can never share a checkbox id. */
  checkboxId: string;
}

/**
 * The one-and-only render surface for plaintext backup codes. Callers must drop
 * the codes from their own state the moment the step advances — the backend
 * cannot re-issue them, and nothing outside this reveal may show them again.
 */
export function BackupCodesReveal({
  codes,
  acknowledged,
  onAcknowledgedChange,
  checkboxId,
}: BackupCodesRevealProps) {
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/40 p-3">
        {codes.map((code) => (
          <li
            key={code}
            className="select-all rounded-lg border border-border/60 bg-card px-2 py-1.5 text-center font-mono-data tracking-wide text-foreground"
          >
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        <CopyButton label="Copy all codes" value={codes.join("\n")} className="flex-1" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            const ok = downloadTextFile("cleanm-admin-backup-codes.txt", backupCodesFileBody(codes));
            if (ok) {
              toast.success("Backup codes downloaded.");
            } else {
              toast.error("Download blocked — copy the codes instead.");
            }
          }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Download .txt
        </Button>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-secondary/60 px-3 py-2.5">
        <Checkbox
          id={checkboxId}
          checked={acknowledged}
          onCheckedChange={(checked) => onAcknowledgedChange(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor={checkboxId} className="text-xs font-normal leading-relaxed text-muted-foreground">
          I have saved these codes
        </Label>
      </div>
    </div>
  );
}

export interface TwoFactorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * True when TOTP is already on. The backend then refuses `/2fa/setup` without a
   * current TOTP or backup code, so the first step collects one.
   */
  alreadyEnabled?: boolean;
  onComplete?: () => void;
}

/**
 * TOTP enrollment as a five-step stepper: `init → scan → verify → backup → done`.
 *
 * No QR image is rendered. Drawing one needs either a QR library (a new
 * dependency for a single screen) or a hand-rolled encoder, so the scan step
 * instead shows the `otpauth://` URI as selectable text, an "Open in
 * authenticator" deep link that hands it straight to an installed app, and the
 * base32 secret for manual entry. A QR canvas can be dropped in later without
 * touching the flow.
 */
export function TwoFactorSetupDialog({
  open,
  onOpenChange,
  alreadyEnabled = false,
  onComplete,
}: TwoFactorSetupDialogProps) {
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState<TwoFactorSetupStep>("init");
  const [proofCode, setProofCode] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [otpauthUri, setOtpauthUri] = React.useState("");
  const [verifyCode, setVerifyCode] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /** Wipes every secret this dialog held. Called on close and on reaching `done`. */
  const forgetSecrets = React.useCallback(() => {
    setProofCode("");
    setSecret("");
    setOtpauthUri("");
    setVerifyCode("");
    setBackupCodes([]);
  }, []);

  const resetAll = React.useCallback(() => {
    setStep("init");
    setAcknowledged(false);
    setError(null);
    forgetSecrets();
  }, [forgetSecrets]);

  const setupMutation = useMutation({
    mutationFn: (code?: string) => setupTotp(code),
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => verifyTotp(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_QUERY_KEY });
    },
  });

  /**
   * The backup step is a one-way door: TOTP is already enabled server-side and the
   * codes cannot be re-issued, so every dismissal path (footer, X, Escape,
   * click-outside — Radix funnels them all through here) is refused until the
   * acknowledgement is ticked.
   */
  function handleOpenChange(next: boolean) {
    if (!next && step === "backup" && !acknowledged) {
      toast.error("Save your backup codes first — they cannot be shown again.");
      return;
    }
    if (!next) resetAll();
    onOpenChange(next);
  }

  async function startEnrollment() {
    const proof = normalizeProofCode(proofCode);
    if (alreadyEnabled && !proof) return;
    setError(null);
    try {
      const data = await setupMutation.mutateAsync(alreadyEnabled ? proof : undefined);
      setSecret(data.secret);
      setOtpauthUri(data.otpauthUri);
      setProofCode("");
      setStep("scan");
    } catch (err) {
      setError(adminAuthErrorCopy(err as ApiError));
    }
  }

  async function submitVerification(code: string) {
    if (code.length !== TOTP_CODE_LENGTH || verifyMutation.isPending) return;
    setError(null);
    try {
      const data = await verifyMutation.mutateAsync(code);
      setBackupCodes(data.backupCodes);
      // The authenticator is live now — the pending secret has no further use.
      setSecret("");
      setOtpauthUri("");
      setVerifyCode("");
      setAcknowledged(false);
      setStep("backup");
    } catch (err) {
      setError(adminAuthErrorCopy(err as ApiError));
      setVerifyCode("");
    }
  }

  function finishSetup() {
    if (!acknowledged) return;
    forgetSecrets();
    setStep("done");
    toast.success("Two-factor authentication is on.");
  }

  const canStart = !alreadyEnabled || normalizeProofCode(proofCode).length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "init" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {alreadyEnabled ? (
                  <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" />
                ) : (
                  <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                )}
                {alreadyEnabled ? "Replace your authenticator app" : "Enable two-factor authentication"}
              </DialogTitle>
              <DialogDescription>
                {alreadyEnabled
                  ? "Enrolling a new authenticator retires the current one and replaces every backup code. Confirm with a code from the authenticator you have now, or one of your backup codes."
                  : "Pair an authenticator app — Google Authenticator, 1Password, Authy — then confirm one code. You will also get eight single-use backup codes."}
              </DialogDescription>
            </DialogHeader>

            {alreadyEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="totp-setup-current-code">Current code</Label>
                <Input
                  id="totp-setup-current-code"
                  inputMode="text"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  maxLength={PROOF_CODE_MAX_LENGTH}
                  placeholder="6-digit code or backup code"
                  value={proofCode}
                  onChange={(event) => setProofCode(normalizeProofCode(event.target.value))}
                  className="font-mono-data tracking-widest"
                />
              </div>
            )}

            {error && <AuthErrorPill message={error} />}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canStart || setupMutation.isPending}
                onClick={() => void startEnrollment()}
              >
                {setupMutation.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {alreadyEnabled ? "Continue" : "Get started"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "scan" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" aria-hidden="true" />
                Add Cleanm to your authenticator
              </DialogTitle>
              <DialogDescription>
                Open the link on the device holding your authenticator, or type the setup key in by
                hand. Do not share either with anyone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground/80">Setup key</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-border/60 bg-muted/40 px-3 py-2 font-mono-data tracking-widest text-foreground">
                    {secret}
                  </code>
                  <CopyButton label="Copy setup key" value={secret} variant="ghost" className="shrink-0" />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground/80">Setup link</p>
                <code className="block select-all break-all rounded-lg border border-border/60 bg-muted/40 px-3 py-2 font-mono-data text-muted-foreground">
                  {otpauthUri}
                </code>
                <a
                  href={otpauthUri}
                  className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Open in authenticator
                </a>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => setStep("verify")}>
                Enter a code
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Confirm the pairing
              </DialogTitle>
              <DialogDescription>
                Enter the 6-digit code your authenticator is showing for Cleanm.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <OtpInput
                id="totp-verify-code"
                length={TOTP_CODE_LENGTH}
                value={verifyCode}
                onChange={setVerifyCode}
                onComplete={(code) => void submitVerification(code)}
                disabled={verifyMutation.isPending}
                autoFocus
                aria-label="Verification code"
              />
              {error && <AuthErrorPill message={error} />}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setStep("scan")}>
                Back
              </Button>
              <Button
                type="button"
                disabled={verifyCode.length !== TOTP_CODE_LENGTH || verifyMutation.isPending}
                onClick={() => void submitVerification(verifyCode)}
              >
                {verifyMutation.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Verify
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "backup" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Save your backup codes
              </DialogTitle>
              <DialogDescription>
                Two-factor authentication is on. These {backupCodes.length} codes each work once if you
                lose your authenticator — this is the only time they are shown.
              </DialogDescription>
            </DialogHeader>

            <BackupCodesReveal
              codes={backupCodes}
              acknowledged={acknowledged}
              onAcknowledgedChange={setAcknowledged}
              checkboxId="totp-setup-codes-saved"
            />

            <DialogFooter>
              <Button type="button" disabled={!acknowledged} onClick={finishSetup}>
                Finish setup
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                You are all set
              </DialogTitle>
              <DialogDescription>
                Cleanm will ask for a code from your authenticator the next time you sign in. Your
                backup codes are no longer retrievable — regenerate them from Account Security if you
                ever need a fresh set.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  handleOpenChange(false);
                  onComplete?.();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
