"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: React.ReactNode;
  /**
   * One or two sentences saying what will happen — not a restatement of the
   * title. Required, and not only as a matter of taste: Radix treats a
   * description as mandatory on an alert dialog and warns without one, on the
   * grounds that a decision the user cannot undo has to explain itself.
   */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * `destructive` paints the action button red and adds the warning glyph. Use it
   * for anything that removes access, destroys a secret, or cannot be undone.
   */
  tone?: "default" | "destructive";
}

const DEFAULTS = {
  confirmLabel: "Continue",
  cancelLabel: "Cancel",
  tone: "default",
} as const;

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  /** Called with the admin's answer, exactly once per open. */
  onResolve: (confirmed: boolean) => void;
}

/**
 * The presentational half: a controlled `AlertDialog` that reports one boolean.
 * `AlertDialog` (not `Dialog`) on purpose — it traps focus on the action row and
 * refuses to close on an outside click, which is what a decision deserves.
 */
export function ConfirmDialog({
  open,
  onResolve,
  title,
  description,
  confirmLabel = DEFAULTS.confirmLabel,
  cancelLabel = DEFAULTS.cancelLabel,
  tone = DEFAULTS.tone,
}: ConfirmDialogProps) {
  const destructive = tone === "destructive";

  return (
    <AlertDialog
      open={open}
      // Escape and the (suppressed) outside-click both land here as `false`, so
      // dismissing is a "no" rather than a promise that never settles.
      onOpenChange={(next) => {
        if (!next) onResolve(false);
      }}
    >
      <AlertDialogContent data-testid="confirm-dialog" data-tone={tone} className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {destructive && (
              <TriangleAlert
                className="h-4 w-4 shrink-0 text-destructive-strong"
                aria-hidden="true"
              />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onResolve(false)}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface PendingRequest {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

export interface UseConfirmResult {
  /** Opens the dialog and resolves `true` only if the admin picks the action. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Render this once, anywhere in the component's tree. */
  confirmDialog: React.ReactNode;
}

/**
 * Promise-based confirm, so a guarded action reads top-to-bottom:
 *
 * ```tsx
 * const { confirm, confirmDialog } = useConfirm();
 * ...
 * if (!(await confirm({ title: "Revoke access?", tone: "destructive" }))) return;
 * mutation.mutate();
 * ```
 *
 * Deliberately hook-local rather than a context provider: a provider would make
 * every screen that uses it un-renderable without extra wrapping (including in
 * tests), for no gain at these call sites. The trade-off is that the caller has
 * to render `confirmDialog`.
 */
export function useConfirm(): UseConfirmResult {
  const [request, setRequest] = React.useState<PendingRequest | null>(null);
  // Survives unmount-during-open: a resolver that never settles would leave the
  // awaiting caller hanging forever.
  const pendingRef = React.useRef<PendingRequest | null>(null);

  React.useEffect(
    () => () => {
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    },
    []
  );

  const confirm = React.useCallback((options: ConfirmOptions) => {
    // A second `confirm()` while one is open answers the first with "no" instead
    // of dropping its promise on the floor.
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { options, resolve };
      pendingRef.current = next;
      setRequest(next);
    });
  }, []);

  const handleResolve = React.useCallback((confirmed: boolean) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setRequest(null);
    pending?.resolve(confirmed);
  }, []);

  const confirmDialog = request ? (
    <ConfirmDialog {...request.options} open onResolve={handleResolve} />
  ) : null;

  return { confirm, confirmDialog };
}
