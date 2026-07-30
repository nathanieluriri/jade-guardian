"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check } from "lucide-react";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AccessPresetSummary } from "@/lib/api/types";

export interface AccessPresetSelectProps {
  presets: AccessPresetSummary[];
  /** `null` for an admin with no named preset (raw `permissionList` only). */
  value: string | null;
  onValueChange: (preset: string) => void;
  id?: string;
  /** Accessible name for the pickers that have no visible `<Label>` (rows, bulk bar). */
  ariaLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  /**
   * Static trigger text, for the per-row picker that sits beside a badge
   * already showing the current preset — without it Radix mirrors the selected
   * option into the trigger and the row reads the same preset name twice.
   */
  triggerLabel?: string;
  /** Repeat the selected preset's description under the trigger (invite dialog). */
  describeSelected?: boolean;
  className?: string;
  size?: "sm" | "default";
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Options are composed from the Radix primitives rather than the shared
 * `SelectItem` wrapper on purpose: that wrapper funnels *all* children into
 * `SelectPrimitive.ItemText`, and Radix mirrors the selected item's `ItemText`
 * into the trigger — so a description passed as a child would be duplicated
 * into every closed trigger. Keeping it a sibling of `ItemText` shows
 * label + description in the open list while the trigger stays one line.
 */
function AccessPresetOption({ preset }: { preset: AccessPresetSummary }) {
  return (
    <SelectPrimitive.Item
      value={preset.key}
      className="relative flex w-full cursor-default select-none flex-col items-start gap-0.5 rounded-sm py-2 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <span className="absolute left-2 top-2.5 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>
        <span className="font-medium">{preset.label}</span>
      </SelectPrimitive.ItemText>
      <span className="text-xs text-muted-foreground">{preset.description}</span>
      {/* Was `text-muted-foreground/80`, which fell to 3.51:1 on the popover. */}
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {preset.permissionCount} permission{preset.permissionCount === 1 ? "" : "s"}
      </span>
    </SelectPrimitive.Item>
  );
}

export function AccessPresetSelect({
  presets,
  value,
  onValueChange,
  id,
  ariaLabel,
  disabled,
  isLoading,
  placeholder = "Choose a preset",
  triggerLabel,
  describeSelected = false,
  className,
  size = "default",
  ...rest
}: AccessPresetSelectProps) {
  const selected = presets.find((preset) => preset.key === value) || null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Select
        // `""` is Radix's documented "no selection, show the placeholder" value;
        // `undefined` would make the select uncontrolled until the first pick.
        value={value ?? ""}
        onValueChange={onValueChange}
        disabled={disabled || isLoading || presets.length === 0}
      >
        <SelectTrigger
          id={id}
          aria-label={ariaLabel}
          className={cn(size === "sm" && "h-9 min-w-[9.5rem] text-xs")}
          {...rest}
        >
          {triggerLabel ? (
            <SelectValue>{triggerLabel}</SelectValue>
          ) : (
            <SelectValue placeholder={isLoading ? "Loading presets..." : placeholder} />
          )}
        </SelectTrigger>
        <SelectContent className="max-w-[22rem]">
          {presets.map((preset) => (
            <AccessPresetOption key={preset.key} preset={preset} />
          ))}
        </SelectContent>
      </Select>
      {describeSelected && selected && <p className="text-xs text-muted-foreground">{selected.description}</p>}
    </div>
  );
}
