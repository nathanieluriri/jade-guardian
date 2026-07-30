"use client";

import * as React from "react";
import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from "input-otp";
import { cn } from "@/lib/utils";

export interface OtpInputProps {
  /** Number of digit slots. */
  length?: number;
  /** Controlled value — always the joined digit string. */
  value: string;
  onChange: (value: string) => void;
  /** Fires the instant the final slot fills, whether typed, pasted or autofilled. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Set this to pair the group with a visible `<label htmlFor>`. */
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/**
 * Boxed one-time-code field.
 *
 * Built on `input-otp`, which keeps a single real input under the slots: that
 * is what gives us free paste handling, arrow/backspace navigation,
 * auto-advance, iOS/Android SMS autofill and one focus stop for screen
 * readers and keyboards. The slots below are pure presentation driven by the
 * library's render props.
 *
 * `pushPasswordManagerStrategy="none"` disables the library's password-manager
 * badge probing — the admin code is never a saved credential, and the probe
 * relies on `document.elementFromPoint`, which jsdom does not implement.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  id,
  name,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: OtpInputProps) {
  return (
    <OTPInput
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      maxLength={length}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern={REGEXP_ONLY_DIGITS}
      pushPasswordManagerStrategy="none"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      containerClassName={cn(
        "flex w-full items-center justify-center gap-1.5 sm:gap-2.5",
        disabled && "opacity-60",
        className
      )}
      render={({ slots }) => (
        <>
          {slots.map((slot, index) => (
            <React.Fragment key={index}>
              {length % 2 === 0 && index === length / 2 && (
                <span aria-hidden="true" className="h-px w-2 shrink-0 rounded-full bg-border sm:w-3" />
              )}
              <OtpSlot {...slot} />
            </React.Fragment>
          ))}
        </>
      )}
    />
  );
}

function OtpSlot({ char, placeholderChar, isActive, hasFakeCaret }: SlotProps) {
  return (
    <div
      className={cn(
        // Fluid width with a cap: the row then fits any viewport the card
        // reaches without ever scrolling sideways.
        "relative flex h-12 min-w-0 flex-1 basis-0 items-center justify-center rounded-xl border bg-card text-xl font-semibold tabular-nums text-foreground shadow-auth-field transition-all duration-150 sm:h-14 sm:text-2xl",
        "max-w-[2.75rem] sm:max-w-[3rem]",
        isActive
          ? "z-10 -translate-y-0.5 border-primary shadow-brand-soft ring-2 ring-ring/25"
          : char !== null
            ? "border-input"
            : "border-border/70"
      )}
    >
      {char ?? placeholderChar ?? ""}
      {hasFakeCaret && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="h-6 w-px animate-caret-blink bg-primary motion-reduce:animate-none" />
        </span>
      )}
    </div>
  );
}
