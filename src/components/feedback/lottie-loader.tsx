"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { DotLottieReactProps } from "@lottiefiles/dotlottie-react";
import { cn } from "@/lib/utils";

/** Full-screen boot splash animation. */
export const CLEANING_LOTTIE_SRC = "/marcus_loading_animations/Cleaning.lottie";
/**
 * Compact in-app loader. The filename really does contain a space and
 * parentheses — it stays percent-encoded so the request survives strict
 * URL parsers and CDNs.
 */
export const SCRUB_BRUSH_LOTTIE_SRC = "/marcus_loading_animations/Scrub%20Brush%20(Edit).lottie";

type LottiePlayer = (props: DotLottieReactProps) => ReactNode;

let playerPromise: Promise<LottiePlayer | null> | null = null;

/**
 * One import promise per session, started only after something has mounted:
 * the player drags in a wasm renderer that must never sit between the user and
 * first paint. A failed import resolves to `null` and stays cached, so a
 * blocked or broken chunk degrades to the spinner once instead of re-trying on
 * every mount.
 */
function loadLottiePlayer(): Promise<LottiePlayer | null> {
  if (!playerPromise) {
    playerPromise = import("@lottiefiles/dotlottie-react")
      .then((mod) => mod.DotLottieReact as LottiePlayer)
      .catch(() => null);
  }
  return playerPromise;
}

export interface LottieLoaderProps {
  src: string;
  /** Box size for the animation, e.g. `h-40 w-40`. */
  className?: string;
  /** Size of the spinner shown while the player loads, or if it never does. */
  fallbackClassName?: string;
  /** `false` freezes the animation on its first frame — the reduced-motion path. */
  play?: boolean;
}

/**
 * Decorative loading animation with a guaranteed fallback. Always
 * `aria-hidden`: the surrounding loading region owns the announcement.
 */
export function LottieLoader({ src, className, fallbackClassName, play = true }: LottieLoaderProps) {
  const [Player, setPlayer] = useState<LottiePlayer | null>(null);

  useEffect(() => {
    let active = true;
    void loadLottiePlayer().then((component) => {
      if (active && component) setPlayer(() => component);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={cn("grid place-items-center", className)} aria-hidden="true">
      {Player ? (
        <Player src={src} autoplay={play} loop={play} className="h-full w-full" />
      ) : (
        <Loader2
          data-testid="lottie-fallback"
          className={cn(
            "animate-spin text-primary motion-reduce:animate-none",
            fallbackClassName ?? "h-10 w-10"
          )}
        />
      )}
    </div>
  );
}
