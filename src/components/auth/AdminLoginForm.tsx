"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, KeyRound, Lock, Mail } from "lucide-react";
import { AuthScreenShell } from "@/components/auth/auth-screen-shell";
import {
  AuthErrorPill,
  AuthField,
  AuthPasswordField,
  AuthPrimaryButton,
} from "@/components/auth/auth-primitives";
import { OtpInput } from "@/components/ui/otp-input";
import { useAdminLoginFlow } from "@/hooks/use-admin-auth";

const OTP_LENGTH = 6;

const credentialsSchema = z.object({
  email: z.string().min(1, "Enter your admin email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type CredentialsValues = z.infer<typeof credentialsSchema>;

/**
 * Keeps the shape of the address recognisable without echoing it back in full
 * on a screen anyone can reach: first two and last character of the local
 * part survive, the domain stays intact.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 3) return `${local.slice(0, 1)}••@${domain}`;
  return `${local.slice(0, 2)}${"•".repeat(Math.max(2, local.length - 3))}${local.slice(-1)}@${domain}`;
}

/**
 * Two-state admin sign-in: credentials, then the OTP challenge the backend
 * issues for every admin login. The state machine itself lives in
 * `useAdminLoginFlow` — this component only renders it, so `OTP_LOCKED`
 * dropping back to the credentials state (with the lockout copy still on
 * screen) happens for free.
 */
export function AdminLoginForm() {
  const { step, submitCredentials, submitOtp, backToCredentials, error, isPending } =
    useAdminLoginFlow();
  const [code, setCode] = useState("");

  const isOtpStep = step.kind === "otp";
  const forgotPasswordBaseUrl = process.env.NEXT_PUBLIC_AUTH0_RESET_PASSWORD_URL;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CredentialsValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });
  const emailValue = watch("email");

  // A fresh challenge always starts from an empty field.
  useEffect(() => {
    if (!isOtpStep) setCode("");
  }, [isOtpStep]);

  const forgotPasswordHref = forgotPasswordBaseUrl
    ? `${forgotPasswordBaseUrl}${forgotPasswordBaseUrl.includes("?") ? "&" : "?"}email=${encodeURIComponent(emailValue ?? "")}`
    : undefined;

  const onSubmitCredentials = handleSubmit(async (values) => {
    await submitCredentials(values);
  });

  async function verifyCode(value: string) {
    if (value.length < OTP_LENGTH || isPending) return;
    await submitOtp(value);
    // Whatever the outcome, the burnt code should not linger in the boxes.
    setCode("");
  }

  const errorPill = error ? <AuthErrorPill message={error} /> : null;

  return (
    <AuthScreenShell
      title={isOtpStep ? "Two-factor authentication" : "Admin sign-in"}
      subtitle={
        isOtpStep
          ? "One more step before you reach the console."
          : "Sign in to the Cleanm admin console."
      }
      aside={
        isOtpStep ? null : (
          <p className="text-center text-xs text-muted-foreground">
            Need an account? Ask a super admin to send you an invite.
          </p>
        )
      }
    >
      {step.kind === "otp" ? (
        <div
          key="otp"
          className="space-y-6 duration-300 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
        >
          <div className="flex justify-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
              <KeyRound className="h-7 w-7 text-primary-strong" aria-hidden="true" />
            </span>
          </div>

          <p data-testid="otp-method-copy" className="text-center text-sm text-muted-foreground">
            {step.method === "totp" ? (
              "Enter the code from your authenticator app"
            ) : (
              <>
                We emailed a 6-digit code to{" "}
                <span className="font-medium text-foreground">{maskEmail(step.email)}</span>
              </>
            )}
          </p>

          <div className="space-y-3">
            <label
              htmlFor="otp-code"
              className="block text-center text-xs font-medium text-foreground/80"
            >
              Verification code
            </label>
            <OtpInput
              id="otp-code"
              length={OTP_LENGTH}
              value={code}
              onChange={setCode}
              onComplete={(value) => void verifyCode(value)}
              disabled={isPending}
              autoFocus
              aria-describedby={step.method === "email" ? "otp-code-hint" : undefined}
            />
            {step.method === "email" && (
              <p id="otp-code-hint" className="text-center text-[11px] text-muted-foreground">
                Can&apos;t find it? Check your spam folder.
              </p>
            )}
          </div>

          {errorPill}

          <AuthPrimaryButton
            type="button"
            onClick={() => void verifyCode(code)}
            disabled={code.length < OTP_LENGTH}
            isPending={isPending}
            pendingLabel="Verifying…"
          >
            Verify code
          </AuthPrimaryButton>

          <button
            type="button"
            onClick={backToCredentials}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to sign-in
          </button>
        </div>
      ) : (
        <form
          key="credentials"
          onSubmit={onSubmitCredentials}
          noValidate
          className="space-y-5 duration-300 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
        >
          <AuthField
            id="email"
            label="Email"
            icon={Mail}
            type="email"
            placeholder="admin@cleanm.com"
            autoComplete="email"
            autoFocus
            error={errors.email?.message}
            {...register("email")}
          />

          <AuthPasswordField
            id="password"
            label="Password"
            icon={Lock}
            placeholder="••••••••"
            autoComplete="current-password"
            revealLabel="password"
            error={errors.password?.message}
            labelAction={
              forgotPasswordHref ? (
                <a
                  href={forgotPasswordHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-primary-strong transition-colors hover:text-foreground"
                >
                  Forgot password?
                </a>
              ) : null
            }
            {...register("password")}
          />

          {errorPill}

          <AuthPrimaryButton isPending={isPending} pendingLabel="Signing in…">
            Sign in
          </AuthPrimaryButton>
        </form>
      )}
    </AuthScreenShell>
  );
}
