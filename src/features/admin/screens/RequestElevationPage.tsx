"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { fetchElevationRequestStatus, fetchPermissionGroups, submitElevationRequest } from "@/lib/api/admin-api";
import { AdminLoadingState } from "@/components/AdminLoadingState";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { canAccessAdminAction } from "@/lib/admin-access";

function resolveGroupRequestValue(group: { id?: string; _id?: string; name: string }) {
  return group.id || group._id || group.name;
}

function statusVariant(status?: string) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

export default function RequestElevationPage() {
  const queryClient = useQueryClient();
  const profileQuery = useAdminProfile();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const canReadRequestStatus = canAccessAdminAction(
    { method: "GET", path: "/v1/admins/access/request-elevation/status" },
    profileQuery.data
  );
  const canSubmitRequest = canAccessAdminAction(
    { method: "POST", path: "/v1/admins/access/request-elevation" },
    profileQuery.data
  );

  const groupsQuery = useQuery({
    queryKey: ["admin-access", "permission-groups"],
    queryFn: fetchPermissionGroups,
  });

  const statusQuery = useQuery({
    queryKey: ["admin-access", "request-status"],
    queryFn: fetchElevationRequestStatus,
    enabled: canReadRequestStatus,
    refetchInterval: (query) => {
      const next = query.state.data?.status;
      return next === "PENDING" ? 30_000 : false;
    },
  });

  const submitMutation = useMutation({
    mutationFn: submitElevationRequest,
    onSuccess: async () => {
      toast.success("Elevation request submitted.");
      setSelectedGroups([]);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-access", "request-status"] });
    },
    onError: () => {
      toast.error("Failed to submit elevation request.");
    },
  });

  const groups = useMemo(() => groupsQuery.data || [], [groupsQuery.data]);

  const selectedCount = selectedGroups.length;
  const trimmedReason = reason.trim();
  const canSubmit = canSubmitRequest && selectedCount > 0 && trimmedReason.length >= 10 && !submitMutation.isPending;

  const selectedGroupNames = useMemo(() => {
    const set = new Set(selectedGroups);
    return groups.filter((group) => set.has(resolveGroupRequestValue(group))).map((group) => group.name);
  }, [groups, selectedGroups]);

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Request Elevation</h1>
        <p className="text-sm text-muted-foreground">
          Select permission groups and submit your request for reviewer approval.
        </p>
      </div>

      <div className="surface-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {canReadRequestStatus && (
            <>
              <span className="text-sm text-muted-foreground">Latest request status:</span>
              <Badge variant={statusVariant(statusQuery.data?.status)}>{statusQuery.data?.status || "NONE"}</Badge>
              {typeof statusQuery.data?.reviewer_name === "string" && statusQuery.data.reviewer_name.trim() && (
                <Badge variant="outline">Reviewer: {statusQuery.data.reviewer_name}</Badge>
              )}
              {statusQuery.data?.grantedPermissions?.length ? (
                <Badge variant="success">Granted: {statusQuery.data.grantedPermissions.length}</Badge>
              ) : null}
            </>
          )}
        </div>
        {canReadRequestStatus && statusQuery.data?.reason ? <p className="text-sm text-muted-foreground">Reason: {statusQuery.data.reason}</p> : null}
        {canReadRequestStatus && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => statusQuery.refetch()}
            disabled={statusQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh Status
          </Button>
        )}
      </div>

      <div className="surface-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Select Permission Groups</h2>
          <Badge variant="secondary">{selectedCount} selected</Badge>
        </div>

        {groupsQuery.isLoading && <AdminLoadingState label="Loading groups..." />}
        {groupsQuery.isError && <p className="font-mono-data text-destructive">Failed to load groups.</p>}

        {!groupsQuery.isLoading && !groupsQuery.isError && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">No groups available to request.</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => {
            const value = resolveGroupRequestValue(group);
            const checked = selectedGroups.includes(value);
            const inputId = `group-${value}`;
            const isBuiltIn = group.is_built_in || group.source === "built_in" || group.type === "built_in";
            return (
              <label
                htmlFor={inputId}
                key={value}
                className="rounded-md border border-border p-3 flex items-start gap-3 cursor-pointer hover:border-primary/40"
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  onCheckedChange={(next) => {
                    setSelectedGroups((prev) => {
                      if (next) {
                        if (prev.includes(value)) return prev;
                        return [...prev, value];
                      }
                      return prev.filter((item) => item !== value);
                    });
                  }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={inputId} className="text-sm font-medium cursor-pointer">{group.name}</Label>
                    {isBuiltIn && <Badge variant="outline">Built-in</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{group.description || "No description provided."}</p>
                </div>
              </label>
            );
          })}
        </div>

        {selectedGroupNames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Selected: {selectedGroupNames.join(", ")}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="elevation-reason">Reason</Label>
          <Textarea
            id="elevation-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Describe why you need these permission groups."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Minimum 10 characters. This reason is sent to reviewers with your request.
          </p>
        </div>

        <Button
          onClick={() => submitMutation.mutate({ requestedPermissionGroups: selectedGroups, reason: trimmedReason })}
          disabled={!canSubmit}
        >
          {submitMutation.isPending ? "Submitting..." : "Submit Elevation Request"}
        </Button>
      </div>
    </div>
  );
}
