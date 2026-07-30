"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * The `md` breakpoint from `tailwind.config.ts`. A centred dialog is the right
 * shape once there is room for one; below that a bottom sheet is reachable with
 * a thumb and can be dismissed by dragging, which a dialog cannot.
 */
export const RESPONSIVE_MODAL_QUERY = "(min-width: 768px)";

/**
 * `matchMedia` as an external store rather than `useState` + effect.
 *
 * `useSyncExternalStore` is what makes this hydration-safe: the third argument
 * is the *server* snapshot, so SSR and the hydrating client render agree on the
 * dialog branch and only diverge on the commit after, once the real media query
 * has been read. An effect-based version renders the drawer branch for one paint
 * on every desktop load.
 *
 * Exported because the same question ("am I above `md`?") comes up wherever a
 * surface has two shapes, and because a test can drive it by swapping
 * `window.matchMedia`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const list = window.matchMedia(query);
      // `addListener` is the pre-2019 Safari spelling; jsdom stubs often only
      // provide one of the two, so neither is assumed to exist.
      list.addEventListener?.("change", onStoreChange);
      list.addListener?.(onStoreChange);
      return () => {
        list.removeEventListener?.("change", onStoreChange);
        list.removeListener?.(onStoreChange);
      };
    },
    [query]
  );

  const getSnapshot = React.useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia(query).matches;
  }, [query]);

  return React.useSyncExternalStore(subscribe, getSnapshot, () => true);
}

export interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Rendered as the accessible description — keep it a sentence, not a form. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Actions row. Stacked in the drawer, right-aligned in the dialog. */
  footer?: React.ReactNode;
  /** Extra classes for the content surface (e.g. `sm:max-w-md`). */
  className?: string;
}

/**
 * One modal that is a centred `Dialog` on `md+` and a `vaul` bottom `Drawer`
 * below it. Callers pass content once; the shape is the layout's problem.
 *
 * Both branches carry `data-variant` so a test (or a debugging session) can tell
 * which one is mounted without reaching for implementation details, and both
 * always render a title and description node — Radix and vaul both warn when a
 * dialog has no accessible name, and an untitled modal is a screen-reader dead
 * end regardless.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveModalProps) {
  const isDesktop = useMediaQuery(RESPONSIVE_MODAL_QUERY);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-variant="dialog" className={cn("sm:max-w-md", className)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent data-variant="drawer" className={cn("max-h-[92svh]", className)}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        {children ? <div className="overflow-y-auto px-4 pb-2">{children}</div> : null}
        {footer ? <DrawerFooter className="pt-2">{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  );
}
