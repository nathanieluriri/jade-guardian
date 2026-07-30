"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminLoginFlow } from "@/hooks/use-admin-auth";

// NOTE: This is a minimal functional patch to keep the login screen working
// against the new OTP-aware auth hook. The two-state redesign (branded OTP
// screen, otp-input.tsx, etc.) lands in the dedicated login-screen task.
export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const { step, submitCredentials, submitOtp, backToCredentials, error, isPending } = useAdminLoginFlow();
  const forgotPasswordBaseUrl = process.env.NEXT_PUBLIC_AUTH0_RESET_PASSWORD_URL;

  const forgotPasswordHref = forgotPasswordBaseUrl
    ? `${forgotPasswordBaseUrl}${forgotPasswordBaseUrl.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}`
    : undefined;

  const onSubmitCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    void submitCredentials({ email, password });
  };

  const onSubmitOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void submitOtp(otp);
  };

  if (step.kind === "otp") {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <form onSubmit={onSubmitOtp} className="surface-card w-full max-w-md p-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 p-1">
              <Image
                src="/company_logo.png"
                alt="Cleanm logo"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Two-factor authentication</h1>
              <p className="text-sm text-muted-foreground">
                {step.method === "totp"
                  ? "Enter the code from your authenticator app"
                  : `We emailed a 6-digit code to ${step.email}`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp">Code</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={backToCredentials}
            >
              Back to sign-in
            </button>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Verifying..." : "Verify"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={onSubmitCredentials} className="surface-card w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 p-1">
            <Image
              src="/company_logo.png"
              alt="Cleanm logo"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin Login</h1>
            <p className="text-sm text-muted-foreground">Sign in to Cleanm admin console</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@company.com"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Admin password recovery is handled by Auth0.
          </p>
          {forgotPasswordHref && (
            <a href={forgotPasswordHref} className="text-xs text-primary hover:underline" target="_blank" rel="noreferrer">
              Forgot password?
            </a>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
