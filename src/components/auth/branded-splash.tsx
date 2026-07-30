"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Lightbulb } from "lucide-react";
import { CLEANING_LOTTIE_SRC, LottieLoader } from "@/components/feedback/lottie-loader";
import { cn } from "@/lib/utils";

const TIP_ROTATE_MS = 6000;

interface SplashTip {
  title: string;
  body: string;
}

/**
 * Short, true things about this console — a new admin on their first shift
 * should learn something while the session resolves. Order doesn't matter:
 * the first tip on screen is randomised at mount, so a fast bootstrap still
 * surfaces variety across visits.
 */
const SPLASH_TIPS: readonly SplashTip[] = [
  {
    title: "Jump straight there",
    body: "Press Ctrl+K (⌘K on a Mac) to search alerts and open any admin screen without touching the sidebar.",
  },
  {
    title: "The sidebar mirrors your access",
    body: "You only see the areas your permissions allow. If something looks missing, ask a super admin to widen your preset.",
  },
  {
    title: "Codes, not shared passwords",
    body: "Every sign-in is confirmed with a 6-digit code — emailed to you, or read from your authenticator app once you enrol.",
  },
  {
    title: "Invite, don't lend a login",
    body: "New admins get their own invite with a temporary password that expires after 72 hours.",
  },
  {
    title: "Everything is on the record",
    body: "Admin actions land in Security → Audit Log with the request id attached, so any change can be traced.",
  },
  {
    title: "Your theme is remembered",
    body: "Switch between light and dark from the sidebar footer — the choice is stored per browser and applied before the first paint.",
  },
] as const;

/**
 * Presentation-only boot splash: no session reads, no redirects. Drop it
 * anywhere the screen has to be held while something else settles. Shares the
 * brand block, card language and ambient wash with the auth screens so the
 * boot → login hand-off reads as one surface rather than two.
 *
 * Under `prefers-reduced-motion` every entrance animation, the tip rotation and
 * the Lottie itself stop: the animation freezes on its first frame and the
 * screen becomes a static, still-legible card.
 */
export function BrandedSplash({ label }: { label?: string }) {
  // `null` until mounted so SSR and the hydration render agree — `Math.random()`
  // in a `useState` initialiser would diverge and trip a hydration mismatch.
  const [tipIndex, setTipIndex] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setReducedMotion(prefersReducedMotion);
    setTipIndex(Math.floor(Math.random() * SPLASH_TIPS.length));

    if (prefersReducedMotion) return;

    const id = window.setInterval(() => {
      setTipIndex((index) => ((index ?? 0) + 1) % SPLASH_TIPS.length);
    }, TIP_ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  // Motion classes are dropped entirely (not just overridden) when the user
  // asked for less of it; the media query below is the belt to that braces,
  // covering browsers where `matchMedia` is unavailable.
  const motion = (className: string) => (reducedMotion ? undefined : className);

  const tip = tipIndex === null ? null : SPLASH_TIPS[tipIndex];

  return (
    <div
      role="status"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-10 text-foreground"
    >
      <style>{`
        @keyframes branded-splash-fade-up {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes branded-splash-fade-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes branded-splash-progress {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .branded-splash-wordmark {
          animation: branded-splash-fade-up 520ms cubic-bezier(0.22, 1, 0.36, 1) 320ms both;
        }
        .branded-splash-tagline {
          animation: branded-splash-fade-in 640ms ease-out 620ms both;
        }
        .branded-splash-tip-card {
          animation: branded-splash-fade-in 520ms ease-out 980ms both;
        }
        .branded-splash-tip-content {
          animation: branded-splash-fade-up 380ms ease-out both;
        }
        .branded-splash-progress-bar {
          animation: branded-splash-progress 1.4s cubic-bezier(0.45, 0, 0.2, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .branded-splash-wordmark,
          .branded-splash-tagline,
          .branded-splash-tip-card,
          .branded-splash-tip-content,
          .branded-splash-progress-bar {
            animation: none !important;
          }
        }
      `}</style>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-28 h-[380px] w-[380px] rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center">
        <LottieLoader
          src={CLEANING_LOTTIE_SRC}
          play={!reducedMotion}
          className="h-40 w-40"
          fallbackClassName="h-10 w-10"
        />

        <div className={cn("mt-4 flex flex-col items-center text-center", motion("branded-splash-wordmark"))}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-card p-2 shadow-auth-field">
              <Image
                src="/company_logo.png"
                alt=""
                aria-hidden="true"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
            </span>
            <span className="text-3xl font-bold tracking-tight">Cleanm</span>
          </div>
          <p className={cn("mt-2 text-sm text-muted-foreground", motion("branded-splash-tagline"))}>
            Admin console
          </p>
        </div>

        {tip && (
          <div
            aria-hidden="true"
            className={cn(
              "mt-10 w-full rounded-2xl border border-border/60 bg-card p-4 text-left shadow-auth-card",
              motion("branded-splash-tip-card")
            )}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Tip
            </div>
            <div key={tipIndex} className={cn("mt-1", motion("branded-splash-tip-content"))}>
              <p data-testid="splash-tip-title" className="text-sm font-semibold text-foreground">
                {tip.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
            </div>
          </div>
        )}
      </div>

      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-primary/10">
        <div className={cn("h-full w-1/4 bg-primary", motion("branded-splash-progress-bar"))} />
      </div>

      <span className="sr-only">{label ?? "Loading the admin console, please wait."}</span>
    </div>
  );
}
