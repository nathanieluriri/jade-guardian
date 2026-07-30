"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccessPresetSelect } from "@/features/admins/components/access-preset-select";
import { TEMP_PASSWORD_TTL_COPY, useInviteAdmin } from "@/features/admins/hooks/use-admins";
import type { AccessPresetSummary } from "@/lib/api/types";

/**
 * `accessPreset` is validated against the keys the backend actually served, so
 * a stale hard-coded list can never post a preset the server would 404 on.
 */
function buildInviteSchema(presetKeys: string[]) {
  return z.object({
    fullName: z.string().trim().min(1, "Enter the admin's full name"),
    email: z.string().trim().min(1, "Enter an email address").email("Enter a valid email address"),
    accessPreset: z
      .string()
      .refine((value) => presetKeys.includes(value), { message: "Choose an access preset" }),
  });
}

type InviteFormValues = { fullName: string; email: string; accessPreset: string };

const EMPTY_FORM: InviteFormValues = { fullName: "", email: "", accessPreset: "" };

export interface InviteAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: AccessPresetSummary[];
  isLoadingPresets?: boolean;
}

export function InviteAdminDialog({ open, onOpenChange, presets, isLoadingPresets }: InviteAdminDialogProps) {
  const inviteMutation = useInviteAdmin();
  const presetKeys = useMemo(() => presets.map((preset) => preset.key), [presets]);
  const schema = useMemo(() => buildInviteSchema(presetKeys), [presetKeys]);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  const { errors } = form.formState;
  const accessPreset = form.watch("accessPreset");

  useEffect(() => {
    if (open) form.reset(EMPTY_FORM);
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await inviteMutation.mutateAsync(values);
      onOpenChange(false);
    } catch {
      // The hook already toasts; keep the dialog open so the values survive.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Invite admin</DialogTitle>
          <DialogDescription>
            The backend generates a temporary password, emails it to them, and forces a change on first sign-in. The
            temporary password expires in {TEMP_PASSWORD_TTL_COPY} — resend the invite after that.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="invite-full-name">Full name</Label>
            <Input
              id="invite-full-name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              aria-invalid={!!errors.fullName}
              {...form.register("fullName")}
            />
            {errors.fullName && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="ada@cleanm.io"
              aria-invalid={!!errors.email}
              {...form.register("email")}
            />
            {errors.email && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-access-preset">Access preset</Label>
            <AccessPresetSelect
              id="invite-access-preset"
              presets={presets}
              isLoading={isLoadingPresets}
              value={accessPreset || null}
              onValueChange={(preset) => form.setValue("accessPreset", preset, { shouldValidate: true })}
              describeSelected
              aria-invalid={!!errors.accessPreset}
            />
            {errors.accessPreset && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.accessPreset.message}
              </p>
            )}
            {!isLoadingPresets && presets.length === 0 && (
              <p role="alert" className="text-sm font-medium text-destructive">
                Access presets could not be loaded, so an invite can&apos;t be scoped. Reload and try again.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={inviteMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={inviteMutation.isPending || presets.length === 0}>
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending invite...
                </>
              ) : (
                <>
                  <MailPlus className="h-4 w-4" />
                  Send invite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
