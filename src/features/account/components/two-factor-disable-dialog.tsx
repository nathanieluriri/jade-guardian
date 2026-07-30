"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldAlert, ShieldOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthErrorPill } from "@/components/auth/auth-primitives";
import { PROOF_CODE_MAX_LENGTH } from "@/features/account/components/two-factor-setup-dialog";
import { ADMIN_PROFILE_QUERY_KEY } from "@/hooks/use-admin-auth";
import { disableTotp } from "@/lib/api/admin-api";
import { adminAuthErrorCopy } from "@/lib/api/auth-errors";
import type { ApiError } from "@/lib/api/types";

export interface TwoFactorDisableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

/**
 * Turning TOTP off needs proof of the current factor — a live 6-digit code or one
 * of the 10-character backup codes. The backend clears the secret and every
 * backup code, so the copy is deliberately blunt about what is lost.
 */
export function TwoFactorDisableDialog({
  open,
  onOpenChange,
  onComplete,
}: TwoFactorDisableDialogProps) {
  const queryClient = useQueryClient();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const disableMutation = useMutation({
    mutationFn: (proof: string) => disableTotp(proof),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_QUERY_KEY });
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCode("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    const proof = code.replace(/\s+/g, "");
    if (!proof || disableMutation.isPending) return;
    setError(null);
    try {
      await disableMutation.mutateAsync(proof);
      toast.success("Two-factor authentication is off.");
      handleOpenChange(false);
      onComplete?.();
    } catch (err) {
      setError(adminAuthErrorCopy(err as ApiError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-destructive-strong" aria-hidden="true" />
            Disable two-factor authentication
          </DialogTitle>
          <DialogDescription>
            Your account will be protected by its password alone, and all eight backup codes are
            destroyed. Confirm with a code from your authenticator, or a backup code.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive-strong" aria-hidden="true" />
          <p className="text-xs text-destructive-strong">
            Admin activity is monitored. Removing your second factor is recorded in the audit log.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="totp-disable-code">Current code</Label>
          <Input
            id="totp-disable-code"
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
            Keep it on
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={code.length === 0 || disableMutation.isPending}
            onClick={() => void submit()}
          >
            {disableMutation.isPending && (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Disable 2FA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
