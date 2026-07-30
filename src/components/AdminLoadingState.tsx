"use client";

import { LottieLoader, SCRUB_BRUSH_LOTTIE_SRC } from "@/components/feedback/lottie-loader";

/**
 * The in-app loading state: same brand family as the boot splash, one size
 * down. Falls back to the plain spinner while the Lottie player loads, or
 * permanently if it can't be fetched at all.
 */
export function AdminLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen grid place-items-center" role="status" aria-live="polite" aria-busy="true">
      <LottieLoader src={SCRUB_BRUSH_LOTTIE_SRC} className="h-24 w-24" fallbackClassName="h-10 w-10" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
