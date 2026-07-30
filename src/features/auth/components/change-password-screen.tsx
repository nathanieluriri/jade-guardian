"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Lock, LogOut, ShieldCheck } from "lucide-react";
import { AuthScreenShell } from "@/components/auth/auth-screen-shell";
import {
  AuthErrorPill,
  AuthPasswordField,
  AuthPrimaryButton,
} from "@/components/auth/auth-primitives";
import {
  ADMIN_PROFILE_QUERY_KEY,
  useAdminLogout,
  useAdminProfile,
  useChangePassword,
} from "@/hooks/use-admin-auth";
import { resolveFirstAllowedAdminRoute } from "@/lib/admin-access";
import { adminAuthErrorCopy } from "@/lib/api/auth-errors";
import type { AdminProfile, ApiError } from "@/lib/api/types";

/** The backend's floor — mirrored here so the button never posts a doomed value. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Change-password surface, reached two ways: the forced `mustChangePassword`
 * redirect after an invite's temporary password, and self-service from
 * security settings. Same card language as the login screen.
 *
 * The redirect target is read from the profile the mutation just refetched, so
 * an admin who has only been granted a corner of the console still lands
 * somewhere they can actually see.
 */
export function ChangePasswordScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profileQuery = useAdminProfile();
  const changePassword = useChangePassword();
  const logout = useAdminLogout();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const reusesCurrent = newPassword.length > 0 && newPassword === currentPassword;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword === newPassword &&
    !reusesCurrent &&
    !changePassword.isPending;

  const accountEmail = profileQuery.data?.email;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toast.success("Password updated. You're all set.");
      const profile =
        queryClient.getQueryData<AdminProfile>(ADMIN_PROFILE_QUERY_KEY) ?? profileQuery.data;
      router.replace(resolveFirstAllowedAdminRoute(profile));
    } catch (err) {
      setError(adminAuthErrorCopy(err as ApiError));
    }
  }

  return (
    <AuthScreenShell
      title="Set a new password"
      subtitle="Choose a password for your Cleanm admin account."
      aside={
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sign out instead
        </button>
      }
    >
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/60 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">
          A temporary password from an invite stops working the moment this succeeds
          {accountEmail ? (
            <>
              {" "}
              — you&apos;ll stay signed in as{" "}
              <span className="font-medium text-foreground">{accountEmail}</span>.
            </>
          ) : (
            "."
          )}
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <AuthPasswordField
          id="current-password"
          label="Current password"
          icon={KeyRound}
          placeholder="••••••••"
          autoComplete="current-password"
          revealLabel="current password"
          autoFocus
          hint="If you were invited, this is the temporary password from your email."
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />

        <AuthPasswordField
          id="new-password"
          label="New password"
          icon={Lock}
          placeholder="••••••••"
          autoComplete="new-password"
          revealLabel="new password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={
            tooShort
              ? `Use at least ${MIN_PASSWORD_LENGTH} characters`
              : reusesCurrent
                ? "Choose something different from your current password"
                : undefined
          }
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />

        <AuthPasswordField
          id="confirm-password"
          label="Confirm password"
          icon={Lock}
          placeholder="••••••••"
          autoComplete="new-password"
          revealLabel="confirm password"
          error={mismatch ? "Passwords don't match" : undefined}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />

        {error && <AuthErrorPill message={error} />}

        <AuthPrimaryButton
          disabled={!canSubmit}
          isPending={changePassword.isPending}
          pendingLabel="Updating…"
        >
          Update password
        </AuthPrimaryButton>
      </form>
    </AuthScreenShell>
  );
}
