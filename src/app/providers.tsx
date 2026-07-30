"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandedSplash } from "@/components/auth/branded-splash";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { hasAuthHint } from "@/lib/api/auth-storage";

/**
 * Floor for the boot splash: long enough that the animation reads as
 * intentional instead of flashing past on a warm cache.
 */
export const MIN_VISIBLE_MS = 1600;
/**
 * Ceiling for the boot splash. A hung API must never trap an admin behind an
 * animation — after this we hand the screen over and let the route guard deal
 * with whatever the profile query eventually says.
 */
export const SAFETY_TIMEOUT_MS = 10_000;

// `useLayoutEffect` warns when it runs during SSR; the splash decision is a
// browser-only concern, so fall back to the passive effect on the server.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Providers({ children, initialTheme }: { children: React.ReactNode; initialTheme: "light" | "dark" }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialTheme={initialTheme}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BootstrapGate>{children}</BootstrapGate>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Holds the branded splash over the app while the very first profile
 * resolution settles, so an admin returning to a deep link sees the brand
 * rather than a half-built console flickering into place.
 *
 * Three rules keep it honest:
 *  - no auth hint → never gate, so `/admin/login` paints on the first frame;
 *  - a settled profile still waits out `MIN_VISIBLE_MS`;
 *  - `SAFETY_TIMEOUT_MS` releases the screen no matter what the API is doing.
 */
export function BootstrapGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"pending" | "gating" | "released">("pending");
  const [minVisibleElapsed, setMinVisibleElapsed] = useState(false);
  const profileQuery = useAdminProfile();
  const profileSettled = profileQuery.isSuccess || profileQuery.isError;

  // The hint lives in localStorage, so the first render has to match the
  // server's (children). Taking the decision in a layout effect flips to the
  // splash before the browser paints — hydration-safe, and no flash of a
  // half-booted console.
  useIsomorphicLayoutEffect(() => {
    setPhase(hasAuthHint() ? "gating" : "released");
  }, []);

  useEffect(() => {
    if (phase !== "gating") return;
    const minVisibleTimer = window.setTimeout(() => setMinVisibleElapsed(true), MIN_VISIBLE_MS);
    const safetyTimer = window.setTimeout(() => setPhase("released"), SAFETY_TIMEOUT_MS);
    return () => {
      window.clearTimeout(minVisibleTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "gating" && profileSettled && minVisibleElapsed) {
      setPhase("released");
    }
  }, [phase, profileSettled, minVisibleElapsed]);

  if (phase === "gating") {
    return <BrandedSplash />;
  }

  return <>{children}</>;
}
