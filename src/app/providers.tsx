"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandedSplash } from "@/components/auth/branded-splash";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { isSessionExpiredError } from "@/lib/api/auth-errors";
import { clearAuthHint, hasAuthHint } from "@/lib/api/auth-storage";
import type { ApiError } from "@/lib/api/types";

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

/** Minimal shape `handleAdminQueryError` needs from `useRouter()` — narrow on purpose so it's trivial to stub in tests. */
export interface AdminQueryErrorRouter {
  replace: (href: string) => void;
}

function isApiErrorLike(error: unknown): error is Partial<ApiError> {
  return typeof error === "object" && error !== null && ("code" in error || "status" in error);
}

/**
 * Central query/mutation error interception. TanStack Query v5 removed
 * per-query `onError` entirely, so a `QueryCache`/`MutationCache`-level
 * handler is the only place left to react to any request's error in one
 * spot, regardless of which screen or hook made it.
 *
 *  - `PASSWORD_CHANGE_REQUIRED`: the backend answers this on *every*
 *    permissioned endpoint the moment `mustChangePassword` flips true (see
 *    ADMIN_AUTH.md), not just the profile fetch. `AdminAuthGate` already
 *    redirects proactively from the profile's own flag; this is the reactive
 *    backstop for every other query/mutation in the app. Guarded against the
 *    path the admin is already on so it can't fight the router on
 *    `/admin/change-password` itself — a bare route rendered outside
 *    `AdminAuthGate` (see `admin/layout.tsx`'s `BARE_ADMIN_ROUTES`) that also
 *    observes the profile query, so a repeat of this same error there must
 *    not re-trigger a redirect to the page it's already on.
 *  - `403 FORBIDDEN`: deliberately a no-op. The session is still good; only
 *    this one action is disallowed. Logging the admin out would turn a
 *    permission error into a strictly worse experience than just refusing the
 *    action — the screen (or `AdminAuthGate`'s route guard) is responsible for
 *    surfacing `PermissionDenied`.
 *  - A *session* 401 that survives `apiRequest`'s own single-flight refresh:
 *    `client.ts` has already cleared the hint by the time this fires; this is
 *    what turns that into an actual navigation for every query/mutation, not
 *    just the profile query `AdminAuthGate` itself observes.
 *  - A *domain* 401 (`isSessionExpiredError` says no): also a no-op, for the
 *    same reason as 403. `INVALID_CREDENTIALS`, `TOTP_INVALID`,
 *    `OTP_INVALID`/`OTP_EXPIRED` are all 401s per ADMIN_AUTH.md, and the screen
 *    that made the request owns them — signing the admin out on a mistyped code
 *    is a strictly worse outcome than the inline error the screen already shows.
 */
export function handleAdminQueryError(
  error: unknown,
  router: AdminQueryErrorRouter,
  currentPath: string | null
): void {
  if (!isApiErrorLike(error)) return;

  if (error.code === "PASSWORD_CHANGE_REQUIRED") {
    if (currentPath !== "/admin/change-password") {
      router.replace("/admin/change-password");
    }
    return;
  }

  if (error.status === 403) {
    return;
  }

  if (isSessionExpiredError(error)) {
    clearAuthHint();
    if (currentPath !== "/admin/login") {
      router.replace("/admin/login");
    }
  }
}

function currentPathname(): string | null {
  return typeof window === "undefined" ? null : window.location.pathname;
}

export function Providers({ children, initialTheme }: { children: React.ReactNode; initialTheme: "light" | "dark" }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
        queryCache: new QueryCache({
          onError: (error) => handleAdminQueryError(error, router, currentPathname()),
        }),
        mutationCache: new MutationCache({
          onError: (error) => handleAdminQueryError(error, router, currentPathname()),
        }),
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

  // The hint lives in localStorage, so the server can't know it and the first
  // client render has to match what the server produced — `null` on both sides
  // (see the `pending` branch below). Taking the decision in a layout effect
  // then flips to the splash (or to `children`) before the browser paints:
  // hydration-safe, and no flash of a half-booted console.
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

  // Nothing at all until the layout effect above has decided. Rendering
  // `children` through the pending frame mounted the entire admin tree — every
  // provider, query and effect under it — only to unmount it again the instant
  // the splash took over, so an admin with a hint paid for a full mount/unmount
  // cycle (and its cancelled requests) before the splash even appeared.
  if (phase === "pending") {
    return null;
  }

  if (phase === "gating") {
    return <BrandedSplash />;
  }

  return <>{children}</>;
}
