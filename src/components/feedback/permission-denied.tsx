import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PermissionRequirement } from "@/lib/admin-access";

export interface PermissionDeniedProps {
  /** The route's declared requirements, when the caller knows them (e.g. `ADMIN_ROUTE_REQUIREMENTS[pathname]`). */
  requirements?: PermissionRequirement[];
  /** Where the "Back to available area" button sends the admin — typically `resolveFirstAllowedAdminRoute(profile)`. */
  backHref: string;
}

function formatRequirement(requirement: PermissionRequirement): string {
  return `${requirement.method} ${requirement.path}`;
}

/**
 * Full-screen empty state `AdminAuthGate` renders in place of a route it has
 * determined the signed-in admin can't open — replacing the silent
 * redirect-to-somewhere-else the guard used to do. That silent bounce left an
 * admin who typed (or bookmarked) a locked URL wondering why they'd landed on
 * a completely different page with no explanation; this names the problem and
 * offers one deliberate way out instead.
 */
export function PermissionDenied({ requirements, backHref }: PermissionDeniedProps) {
  const requiredPermission =
    requirements && requirements.length > 0 ? requirements.map(formatRequirement).join(", ") : null;

  return (
    <div
      data-testid="permission-denied"
      className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground"
    >
      <div className="w-full max-w-[440px] rounded-3xl border border-border/60 bg-card p-8 text-center shadow-auth-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive-strong" aria-hidden="true" />
        </span>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">You don&apos;t have access to this page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your admin account doesn&apos;t have the permission this section requires. Ask a super admin to widen your
          access preset if you need it.
        </p>

        {requiredPermission && (
          <p className="mt-4 rounded-xl border border-border/60 bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            Requires <span className="font-medium text-foreground">{requiredPermission}</span>
          </p>
        )}

        <Button asChild size="lg" className="mt-6 w-full rounded-xl">
          <Link href={backHref}>Back to available area</Link>
        </Button>
      </div>
    </div>
  );
}
