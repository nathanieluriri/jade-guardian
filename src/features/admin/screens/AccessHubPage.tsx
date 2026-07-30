"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, LockKeyhole, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchElevationRequestStatus } from "@/lib/api/admin-api";
import { canAccessAdminAction, getAllowedAdminRoutes } from "@/lib/admin-access";
import { useAdminProfile } from "@/hooks/use-admin-auth";

const landingCards = [
  {
    title: "Permission Groups",
    description: "Review built-in and custom permission groups before requesting elevation.",
    href: "/admin/access/permission-groups",
  },
  {
    title: "Request Elevation",
    description: "Submit an access request by selecting the permission groups you need.",
    href: "/admin/access/request-elevation",
  },
  {
    title: "Access Requests",
    description: "Reviewer queue for approving, partially approving, or rejecting requests.",
    href: "/admin/access/requests",
  },
  {
    title: "Overview",
    description: "System monitoring dashboard for fully privileged admins.",
    href: "/admin/overview",
  },
  {
    title: "Users",
    description: "Manage cleaner and customer user listings and reports.",
    href: "/admin/users",
  },
  {
    title: "Admin Team",
    description: "Create and manage admin accounts and account status.",
    href: "/admin/team",
  },
  {
    title: "Service Definitions",
    description: "Manage base service catalog metadata and duration defaults.",
    href: "/admin/operations/service-definitions",
  },
  {
    title: "Promo Codes",
    description: "Manage discount campaign codes and active windows.",
    href: "/admin/operations/promo-codes",
  },
  {
    title: "Concierge Bookings",
    description: "Create and manage admin-assisted booking flows.",
    href: "/admin/support/concierge-bookings",
  },
  {
    title: "Claim Reviews",
    description: "Review disputes and manage adjudication decisions.",
    href: "/admin/support/claim-reviews",
  },
  {
    title: "Broadcasts",
    description: "Create and manage operational announcements.",
    href: "/admin/governance/broadcasts",
  },
  {
    title: "Availability Overrides",
    description: "Apply temporary availability blocks/unblocks for cleaners.",
    href: "/admin/governance/availability-overrides",
  },
];

function statusVariant(status?: string) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

export default function AccessHubPage() {
  const profileQuery = useAdminProfile();
  const canReadOwnRequestStatus = canAccessAdminAction(
    { method: "GET", path: "/v1/admins/access/request-elevation/status" },
    profileQuery.data
  );
  const statusQuery = useQuery({
    queryKey: ["admin-access", "request-status"],
    queryFn: fetchElevationRequestStatus,
    enabled: canReadOwnRequestStatus,
    refetchInterval: (query) => {
      const next = query.state.data?.status;
      return next === "PENDING" ? 30_000 : false;
    },
  });

  const allowedRoutes = useMemo(() => getAllowedAdminRoutes(profileQuery.data), [profileQuery.data]);

  const visibleCards = useMemo(
    () => landingCards.filter((card) => allowedRoutes.has(card.href)),
    [allowedRoutes]
  );

  const currentStatus = statusQuery.data?.status;

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div className="surface-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-mono-data text-primary">
              <LockKeyhole className="h-3.5 w-3.5" />
              Access Hub
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Your admin account has limited access</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              You can review permission groups and submit an elevation request while waiting for approval.
            </p>
          </div>
          {canReadOwnRequestStatus && (
            <Badge variant={statusVariant(currentStatus)} className="w-fit">
              Request Status: {currentStatus || "NONE"}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {visibleCards.map((card) => (
          <div key={card.href} className="surface-card p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{card.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
              </div>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Button asChild size="sm" className="gap-2">
                <Link href={card.href}>
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
