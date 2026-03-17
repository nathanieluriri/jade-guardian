"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminLogin } from "@/hooks/use-admin-auth";
import type { ApiError } from "@/lib/api/types";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useAdminLogin();
  const forgotPasswordBaseUrl = process.env.NEXT_PUBLIC_AUTH0_RESET_PASSWORD_URL;

  const loginError = loginMutation.error as ApiError | null;
  const loginErrorMessage = loginError
    ? `${loginError.message}${loginError.requestId ? ` (Request ID: ${loginError.requestId})` : ""}`
    : null;

  const forgotPasswordHref = forgotPasswordBaseUrl
    ? `${forgotPasswordBaseUrl}${forgotPasswordBaseUrl.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}`
    : undefined;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={onSubmit} className="surface-card w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin Login</h1>
            <p className="text-sm text-muted-foreground">Sign in to Sentinel admin console</p>
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

        {loginMutation.error && <p className="text-sm text-destructive">{loginErrorMessage || "Failed to login. Check credentials and try again."}</p>}

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

        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
