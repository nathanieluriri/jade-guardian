"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { decideElevationRequest, listElevationRequests } from "@/lib/api/admin-api";
import type { ApiError, DecideElevationRequestPayload, ElevationRequestItem, ElevationStatus } from "@/lib/api/types";
import { canAccessAdminAction } from "@/lib/admin-access";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { AdminLoadingState } from "@/components/AdminLoadingState";

type StatusFilter = ElevationStatus | "ALL";
type DecisionChoice = "APPROVED_FULL" | "APPROVED_PARTIAL" | "REJECTED";

function statusVariant(status: ElevationStatus) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "warning" as const;
}

function formatEpoch(epoch?: number | null): string {
  if (!epoch) return "-";
  return new Date(epoch * 1000).toLocaleString();
}

function errorCodeFromApi(error: ApiError | null): string | undefined {
  if (!error) return undefined;
  if (error.code) return error.code;
  if (!error.details || typeof error.details !== "object") return undefined;
  const details = error.details as { data?: { code?: string } };
  return details.data?.code;
}

export default function AccessRequestsPage() {
  const queryClient = useQueryClient();
  const profileQuery = useAdminProfile();
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);
  const [activeRequest, setActiveRequest] = useState<ElevationRequestItem | null>(null);
  const [decisionChoice, setDecisionChoice] = useState<DecisionChoice>("APPROVED_FULL");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const canDecide = canAccessAdminAction(
    { method: "PATCH", path: "/v1/admins/access/requests/{request_id}/decision" },
    profileQuery.data
  );

  const requestsQuery = useQuery({
    queryKey: ["admin-access", "requests", { filter, skip, limit }],
    queryFn: () =>
      listElevationRequests({
        status: filter === "ALL" ? undefined : filter,
        skip,
        limit,
      }),
  });

  const requests = requestsQuery.data || [];

  const decideMutation = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: string; payload: DecideElevationRequestPayload }) =>
      decideElevationRequest(requestId, payload),
    onSuccess: async () => {
      toast.success("Request decision submitted.");
      setActiveRequest(null);
      setNote("");
      setSelectedPermissions([]);
      setDecisionChoice("APPROVED_FULL");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-access", "requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-access", "request-status"] }),
      ]);
    },
    onError: (error) => {
      const apiError = error as unknown as ApiError;
      const code = errorCodeFromApi(apiError);
      if (code === "REQUEST_ALREADY_REVIEWED" || apiError.status === 409) {
        toast.error("This request has already been reviewed.");
        queryClient.invalidateQueries({ queryKey: ["admin-access", "requests"] });
        return;
      }
      if (apiError.status === 422) {
        toast.error("Invalid decision payload. Check note/permissions and try again.");
        return;
      }
      toast.error(apiError.message || "Failed to submit decision.");
    },
  });

  const openDecisionDialog = (request: ElevationRequestItem) => {
    setActiveRequest(request);
    setDecisionChoice("APPROVED_FULL");
    setSelectedPermissions([]);
    setNote("");
  };

  const isReviewed = activeRequest?.status === "APPROVED" || activeRequest?.status === "REJECTED";

  const canSubmitDecision = useMemo(() => {
    if (!activeRequest || !canDecide) return false;
    if (activeRequest.status !== "PENDING") return false;
    if (decisionChoice === "APPROVED_PARTIAL") {
      return selectedPermissions.length > 0;
    }
    return true;
  }, [activeRequest, canDecide, decisionChoice, selectedPermissions.length]);

  const submitDecision = () => {
    if (!activeRequest || !canSubmitDecision) return;
    const payload: DecideElevationRequestPayload =
      decisionChoice === "REJECTED"
        ? { decision: "REJECTED", note: note.trim() || undefined }
        : decisionChoice === "APPROVED_PARTIAL"
          ? { decision: "APPROVED", grantedPermissions: selectedPermissions, note: note.trim() || undefined }
          : { decision: "APPROVED", note: note.trim() || undefined };

    decideMutation.mutate({ requestId: activeRequest.requestId, payload });
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Access Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">Review pending elevation requests and issue approval decisions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => requestsQuery.refetch()} disabled={requestsQuery.isFetching}>
            <RefreshCw className={`h-4 w-4 ${requestsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSkip(Math.max(0, skip - limit))} disabled={skip === 0}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSkip(skip + limit)}>
            Next
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(value) => { setFilter(value as StatusFilter); setSkip(0); }}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {requestsQuery.isLoading && <AdminLoadingState label="Loading elevation requests..." />}
        {requestsQuery.isError && <p className="font-mono-data text-destructive">Failed to load elevation requests.</p>}
        {!requestsQuery.isLoading && !requestsQuery.isError && requests.length === 0 && (
          <div className="surface-card p-4">
            <p className="text-sm text-muted-foreground">No requests found for this filter.</p>
          </div>
        )}

        {requests.map((request) => (
          <div key={request.requestId} className="surface-card p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Request {request.requestId}</p>
                <p className="text-xs text-muted-foreground mt-1">Admin: {request.adminId}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
                {request.status === "PENDING" && <Clock3 className="h-4 w-4 text-muted-foreground" />}
                {request.status === "APPROVED" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {request.status === "REJECTED" && <XCircle className="h-4 w-4 text-rose-500" />}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">Reason: {request.reason || "No reason provided."}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-mono-data text-muted-foreground mb-1">Requested Groups</p>
                <p className="text-sm">{request.requestedPermissionGroups.length ? request.requestedPermissionGroups.join(", ") : "-"}</p>
              </div>
              <div>
                <p className="text-xs font-mono-data text-muted-foreground mb-1">Requested Permissions</p>
                <p className="text-sm break-all">{request.requestedPermissions.length ? request.requestedPermissions.join(", ") : "-"}</p>
              </div>
              <div>
                <p className="text-xs font-mono-data text-muted-foreground mb-1">Reviewed By</p>
                <p className="text-sm">{request.reviewedBy || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-mono-data text-muted-foreground mb-1">Reviewed At</p>
                <p className="text-sm">{formatEpoch(request.reviewedAt)}</p>
              </div>
            </div>

            {!!request.decisionNote && <p className="text-sm text-muted-foreground">Decision note: {request.decisionNote}</p>}

            <div className="flex items-center gap-2">
              <Badge variant="outline">Created: {formatEpoch(request.dateCreated)}</Badge>
              <Badge variant="outline">Updated: {formatEpoch(request.lastUpdated)}</Badge>
            </div>

            <div className="pt-1">
              <Button
                size="sm"
                onClick={() => openDecisionDialog(request)}
                disabled={!canDecide || request.status !== "PENDING"}
              >
                {canDecide ? "Review Request" : "Read-only"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!activeRequest} onOpenChange={(open) => !open && setActiveRequest(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Elevation Request</DialogTitle>
            <DialogDescription>
              Decide request {activeRequest?.requestId}. Reviewed requests cannot be edited.
            </DialogDescription>
          </DialogHeader>

          {!activeRequest ? null : (
            <div className="space-y-4">
              {isReviewed && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  This request is already {activeRequest.status.toLowerCase()} and cannot be changed.
                </div>
              )}

              <div className="space-y-2">
                <Label>Decision</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant={decisionChoice === "APPROVED_FULL" ? "default" : "outline"}
                    disabled={isReviewed}
                    onClick={() => setDecisionChoice("APPROVED_FULL")}
                  >
                    Approve Full
                  </Button>
                  <Button
                    type="button"
                    variant={decisionChoice === "APPROVED_PARTIAL" ? "default" : "outline"}
                    disabled={isReviewed || activeRequest.requestedPermissions.length === 0}
                    onClick={() => setDecisionChoice("APPROVED_PARTIAL")}
                  >
                    Partial Approve
                  </Button>
                  <Button
                    type="button"
                    variant={decisionChoice === "REJECTED" ? "destructive" : "outline"}
                    disabled={isReviewed}
                    onClick={() => setDecisionChoice("REJECTED")}
                  >
                    Reject
                  </Button>
                </div>
              </div>

              {decisionChoice === "APPROVED_PARTIAL" && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Label>Granted Permissions (subset of requested)</Label>
                  {activeRequest.requestedPermissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No requested permissions available for partial approval.</p>
                  ) : (
                    <div className="max-h-52 overflow-auto space-y-2">
                      {activeRequest.requestedPermissions.map((permission) => {
                        const id = `grant-${permission}`;
                        const checked = selectedPermissions.includes(permission);
                        return (
                          <label key={permission} htmlFor={id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(next) => {
                                setSelectedPermissions((prev) => {
                                  if (next) {
                                    if (prev.includes(permission)) return prev;
                                    return [...prev, permission];
                                  }
                                  return prev.filter((item) => item !== permission);
                                });
                              }}
                              disabled={isReviewed}
                            />
                            <span className="font-mono-data break-all">{permission}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="decision-note">Decision Note (optional)</Label>
                <Textarea
                  id="decision-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, 2000))}
                  placeholder="Add context for requester and audit trail"
                  rows={4}
                  disabled={isReviewed}
                />
                <p className="text-xs text-muted-foreground">{note.length}/2000</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setActiveRequest(null)}>
                  Cancel
                </Button>
                <Button onClick={submitDecision} disabled={!canSubmitDecision || decideMutation.isPending}>
                  {decideMutation.isPending ? "Submitting..." : "Submit Decision"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
