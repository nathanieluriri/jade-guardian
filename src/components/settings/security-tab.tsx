"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthErrorPill } from "@/components/auth/auth-primitives";
import {
  BackupCodesReveal,
  PROOF_CODE_MAX_LENGTH,
  TwoFactorSetupDialog,
} from "@/features/account/components/two-factor-setup-dialog";
import { TwoFactorDisableDialog } from "@/features/account/components/two-factor-disable-dialog";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { regenerateBackupCodes } from "@/lib/api/admin-api";
import { adminAuthErrorCopy } from "@/lib/api/auth-errors";
import type { ApiError } from "@/lib/api/types";

const CHANGE_PASSWORD_HREF = "/admin/change-password";

/**
 * Regeneration invalidates every existing backup code, so it needs the same proof
 * as any other sensitive 2FA change. The fresh set is revealed exactly once, in
 * place of the form; reopening the dialog always starts from an empty form, never
 * from a remembered set.
 */
function RegenerateBackupCodesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [code, setCode] = React.useState("");
  const [codes, setCodes] = React.useState<string[]>([]);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const regenerateMutation = useMutation({
    mutationFn: (proof: string) => regenerateBackupCodes(proof),
  });

  /** Same one-way door as enrollment: the old codes are already dead, so the new set must be acknowledged. */
  function handleOpenChange(next: boolean) {
    if (!next && codes.length > 0 && !acknowledged) {
      toast.error("Save your new backup codes first — they cannot be shown again.");
      return;
    }
    if (!next) {
      setCode("");
      setCodes([]);
      setAcknowledged(false);
      setError(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    const proof = code.replace(/\s+/g, "");
    if (!proof || regenerateMutation.isPending) return;
    setError(null);
    try {
      const data = await regenerateMutation.mutateAsync(proof);
      setCode("");
      setAcknowledged(false);
      // Replaces whatever the previous call revealed — the old set is dead server-side.
      setCodes(data.backupCodes);
    } catch (err) {
      setError(adminAuthErrorCopy(err as ApiError));
    }
  }

  const revealed = codes.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary-strong" aria-hidden="true" />
            Regenerate backup codes
          </DialogTitle>
          <DialogDescription>
            {revealed
              ? "Your previous codes no longer work. Save this new set — it will not be shown again."
              : "This retires every code you have now and mints eight new ones. Confirm with a code from your authenticator, or a backup code you still hold."}
          </DialogDescription>
        </DialogHeader>

        {revealed ? (
          <>
            <BackupCodesReveal
              codes={codes}
              acknowledged={acknowledged}
              onAcknowledgedChange={setAcknowledged}
              checkboxId="totp-regenerated-codes-saved"
            />
            <DialogFooter>
              <Button type="button" disabled={!acknowledged} onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="totp-regenerate-code">Current code</Label>
              <Input
                id="totp-regenerate-code"
                inputMode="text"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={PROOF_CODE_MAX_LENGTH}
                placeholder="6-digit code or backup code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\s+/g, ""))}
                className="font-mono-data tracking-widest"
              />
            </div>

            {error && <AuthErrorPill message={error} />}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={code.length === 0 || regenerateMutation.isPending}
                onClick={() => void submit()}
              >
                {regenerateMutation.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Generate new codes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Self-service account security: the admin's own second factor and password.
 * Nothing here is permission-gated (see `ALWAYS_ALLOWED_ADMIN_ROUTES`) and
 * nothing here can re-display a secret — the setup and regenerate dialogs own the
 * single reveal, and this surface only ever reads `totpEnabled` off the profile.
 *
 * The change-password link is a plain anchor on purpose: `/admin/change-password`
 * renders outside the admin shell (`BARE_ADMIN_ROUTES`), so a full document load
 * is the honest transition.
 */
export function SecurityTab() {
  const profileQuery = useAdminProfile();
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [disableOpen, setDisableOpen] = React.useState(false);
  const [regenerateOpen, setRegenerateOpen] = React.useState(false);

  const isLoadingProfile = profileQuery.isLoading || !profileQuery.data;
  const totpEnabled = profileQuery.data?.totpEnabled === true;
  const accountEmail = profileQuery.data?.email;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tighter">Account Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two-factor authentication and password controls for
          {accountEmail ? (
            <>
              {" "}
              <span className="font-medium text-foreground">{accountEmail}</span>.
            </>
          ) : (
            " your own admin account."
          )}
        </p>
      </div>

      <section aria-labelledby="two-factor-heading" className="surface-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="two-factor-heading" className="text-base font-semibold">
              Two-factor authentication
            </h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              {totpEnabled
                ? "Sign-in asks for a code from your authenticator app after your password."
                : "Add an authenticator app so a stolen password alone cannot reach the console."}
            </p>
          </div>

          {isLoadingProfile ? (
            <Badge variant="secondary" className="shrink-0 gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Checking
            </Badge>
          ) : (
            <Badge variant={totpEnabled ? "success" : "warning"} className="shrink-0 gap-1.5">
              {totpEnabled ? (
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              )}
              {totpEnabled ? "Enabled" : "Not enabled"}
            </Badge>
          )}
        </div>

        {!isLoadingProfile && (
          <div className="mt-4 flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:flex-wrap">
            {totpEnabled ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setSetupOpen(true)}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Replace authenticator app
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRegenerateOpen(true)}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Regenerate backup codes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive-strong sm:ml-auto"
                  onClick={() => setDisableOpen(true)}
                >
                  <ShieldOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Disable two-factor authentication
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" onClick={() => setSetupOpen(true)}>
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Enable two-factor authentication
              </Button>
            )}
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Backup codes are shown once, when they are created. Nobody — not support, not another admin
          — can retrieve them afterwards; regenerate to get a fresh set.
        </p>
      </section>

      <section aria-labelledby="password-heading" className="surface-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="password-heading" className="text-base font-semibold">
              Password
            </h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Changing your password signs out your other sessions.
            </p>
          </div>
          <a
            href={CHANGE_PASSWORD_HREF}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Change password
          </a>
        </div>
      </section>

      <TwoFactorSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        alreadyEnabled={totpEnabled}
      />
      <TwoFactorDisableDialog open={disableOpen} onOpenChange={setDisableOpen} />
      <RegenerateBackupCodesDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} />
    </div>
  );
}
