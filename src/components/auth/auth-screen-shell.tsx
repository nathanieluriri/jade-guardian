"use client";

import Image from "next/image";
import { ShieldCheck } from "lucide-react";

export interface AuthScreenShellProps {
  /** Card heading — animating it on change is how the two login states read as one screen. */
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Optional row above the trust line (help links, sign-out escape hatch). */
  aside?: React.ReactNode;
}

/**
 * The full-screen chrome shared by every admin auth surface: brand block,
 * animated heading pair, the single elevated card, and the trust footer.
 *
 * All motion is CSS-only via `tailwindcss-animate` and disabled under
 * `prefers-reduced-motion`.
 */
export function AuthScreenShell({ title, subtitle, children, aside }: AuthScreenShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-28 h-[380px] w-[380px] rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-6 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-card p-2 shadow-auth-field">
              <Image
                src="/company_logo.png"
                alt="Cleanm"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
            </span>
            <span className="text-3xl font-bold tracking-tight">Cleanm</span>
          </div>

          <div
            key={title}
            className="space-y-1.5 text-center duration-300 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none"
          >
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <main
          id="main-content"
          className="rounded-3xl border border-border/60 bg-card p-8 shadow-auth-card"
        >
          {children}
        </main>

        <div className="mt-8 flex flex-col items-center gap-3">
          {aside}
          <p
            data-testid="auth-trust-footer"
            className="flex items-center gap-2 text-[11px] text-muted-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary-strong" aria-hidden="true" />
            <span>Protected by Cleanm. Admin activity is monitored and logged.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
