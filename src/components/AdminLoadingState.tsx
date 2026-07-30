"use client";

import { Loader2 } from "lucide-react";

export function AdminLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen grid place-items-center" role="status" aria-live="polite" aria-busy="true">
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-label={label} />
    </div>
  );
}
