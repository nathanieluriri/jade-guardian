"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { createFeatureTemplate, listFeatureTemplates } from "@/lib/api/admin-api";
import type { FeatureTemplate, TemplateFeature } from "@/lib/api/template-types";

const NAME_MAX = 120;

/**
 * Lists saved templates for exactly one feature and lets the caller apply
 * one to the current form. `listFeatureTemplates` has no server-side
 * `feature` filter (the backend endpoint only supports pagination), so
 * every template across all six screens comes back in one list — filtering
 * to this component's `feature` is done here, client-side. Getting this
 * wrong means a promo-code template could appear (and be applicable) on the
 * service-definitions screen.
 */
export function TemplatePicker({
  feature,
  onApply,
}: {
  feature: TemplateFeature;
  onApply: (payload: Record<string, unknown>) => void;
}) {
  const [templates, setTemplates] = useState<FeatureTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listFeatureTemplates()
      .then((all) => {
        if (cancelled) return;
        setTemplates(all.filter((template) => template.feature === feature));
      })
      .catch(() => {
        if (cancelled) return;
        // A failed template fetch is a degraded convenience, not a blocker:
        // the rest of the form must keep working. State the failure rather
        // than silently showing an empty list, so the admin isn't left
        // wondering whether there simply are no templates.
        setError("Failed to load templates. You can still fill out the form manually.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feature]);

  if (loading) {
    return (
      <div className="space-y-2" data-testid="template-picker-loading">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (!templates || templates.length === 0) {
    return <p className="text-sm text-muted-foreground">No templates saved for this feature yet.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Start from a template</p>
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <Button
            key={template.id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onApply(template.payload)}
          >
            {template.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Captures the current form state (`payload`) as a new named template.
 *
 * The save button's disabled state must not rely solely on `useState` —
 * a `disabled` prop derived from state doesn't commit until the next
 * render, and a fast double-click lands inside that window before React
 * re-renders. This exact race was found three separate times in the
 * previous batch (send, resume/cancel, load-more). `savingRef` is read and
 * set synchronously before the mutation starts, so the second click of a
 * double-click bails out immediately.
 */
export function SaveAsTemplateButton({
  feature,
  payload,
}: {
  feature: TemplateFeature;
  payload: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function reset() {
    setName("");
    setNameError(null);
  }

  async function handleSave() {
    if (savingRef.current) return;

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setNameError("Name is required.");
      return;
    }
    if (trimmed.length > NAME_MAX) {
      setNameError(`Name must be ${NAME_MAX} characters or fewer.`);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setNameError(null);
    try {
      await createFeatureTemplate({ feature, name: trimmed, payload });
      toast.success("Template saved.");
      setOpen(false);
      reset();
    } catch {
      toast.error("Failed to save template.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Save as template
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>
            Save the current form values as a reusable template for this feature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="template-name">Name</Label>
          <Input
            id="template-name"
            value={name}
            maxLength={NAME_MAX}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
          />
          {nameError && (
            <p className="text-xs text-destructive" role="alert">
              {nameError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
