"use client";

import * as React from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared form primitives for the two full-screen auth surfaces (login and
 * change-password) so their field, button and error language cannot drift.
 * Everything here is token-coloured: no literals.
 */

const FIELD_CLASS =
  "min-h-[48px] w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-base text-foreground shadow-auth-field outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm";

interface FieldFrameProps {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Rendered at the right of the label row — e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode;
  hint?: string;
  error?: string;
  /** Absolutely positioned control inside the field (the reveal toggle). */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

function FieldFrame({
  id,
  label,
  icon: Icon,
  labelAction,
  hint,
  error,
  trailing,
  children,
}: FieldFrameProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 pl-1">
        <label htmlFor={id} className="text-xs font-medium text-foreground/80">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="group relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground transition-colors group-focus-within:text-primary-strong">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        {children}
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-error`} className="pl-1 text-xs text-destructive-strong">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="pl-1 text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type NativeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

export interface AuthFieldProps extends NativeInputProps {
  id: string;
  label: string;
  icon: LucideIcon;
  labelAction?: React.ReactNode;
  hint?: string;
  error?: string;
}

/** Single-line field with a leading icon that takes the brand colour on focus. */
export const AuthField = React.forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { id, label, icon, labelAction, hint, error, ...inputProps },
  ref
) {
  return (
    <FieldFrame id={id} label={label} icon={icon} labelAction={labelAction} hint={hint} error={error}>
      <input
        {...inputProps}
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(FIELD_CLASS, error && "border-destructive/50 focus:border-destructive focus:ring-destructive/20")}
      />
    </FieldFrame>
  );
});

export interface AuthPasswordFieldProps extends Omit<AuthFieldProps, "type"> {
  /** Used in the toggle's accessible name: "Show {revealLabel}". */
  revealLabel?: string;
}

/** Password field with a reveal toggle that keeps its own accessible name. */
export const AuthPasswordField = React.forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField(
    { id, label, icon, labelAction, hint, error, revealLabel = "password", ...inputProps },
    ref
  ) {
    const [revealed, setRevealed] = React.useState(false);

    return (
      <FieldFrame
        id={id}
        label={label}
        icon={icon}
        labelAction={labelAction}
        hint={hint}
        error={error}
        trailing={
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={`${revealed ? "Hide" : "Show"} ${revealLabel}`}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-xl pr-3.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-primary-strong focus-visible:outline-none"
          >
            {revealed ? (
              <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        }
      >
        <input
          {...inputProps}
          id={id}
          ref={ref}
          type={revealed ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(
            FIELD_CLASS,
            "pr-12",
            error && "border-destructive/50 focus:border-destructive focus:ring-destructive/20"
          )}
        />
      </FieldFrame>
    );
  }
);

export interface AuthPrimaryButtonProps {
  children: React.ReactNode;
  /** Label shown in place of `children` while the request is in flight. */
  pendingLabel: string;
  isPending?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}

/** Brand CTA: label swap with an inline spinner, trailing arrow, press-in feel. */
export function AuthPrimaryButton({
  children,
  pendingLabel,
  isPending = false,
  disabled = false,
  type = "submit",
  onClick,
}: AuthPrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
      // `hover:bg-primary-strong`, not `hover:bg-emerald-600`: now that
      // `--primary` is deepened past emerald-600, hovering onto that step
      // would make the CTA *lighter* and drop the white label to 3.35:1.
      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-brand transition-all duration-200 hover:bg-primary-strong hover:shadow-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 md:text-sm"
    >
      {isPending ? (
        <>
          <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        <>
          {children}
          <ArrowRight className="h-[18px] w-[18px] opacity-90" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

/** Inline error pill announced to assistive tech the moment it appears. */
export function AuthErrorPill({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-strong"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
