"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  Mail,
  Calendar,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchCleanerById,
  listOnboardingQueue,
  reviewCleanerOnboarding,
} from "@/lib/api/admin-api";
import { mapCleanerToOnboarding, type CleanerOnboarding } from "@/lib/onboarding";
import { OnboardingDetail } from "@/components/OnboardingDetail";

function resolveCleanerId(input: { id?: string; _id?: string }): string {
  return input.id || input._id || "";
}

function formatDateTime(iso?: string): string {
  if (!iso) return "Never";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusVariant(status: CleanerOnboarding["onboarding_status"]) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCleanerId, setSelectedCleanerId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const queueQuery = useQuery({
    queryKey: ["admin-onboarding-table", search],
    queryFn: () => listOnboardingQueue({ skip: 0, limit: 100, search: search.trim() }),
  });

  const rows = useMemo(() => {
    return (queueQuery.data || []).map((cleaner) => {
      const resolvedId = resolveCleanerId(cleaner);
      return mapCleanerToOnboarding({
        ...cleaner,
        id: resolvedId,
        profile: cleaner.profile as never,
      });
    });
  }, [queueQuery.data]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      return (
        row.id.toLowerCase().includes(q) ||
        row.firstName.toLowerCase().includes(q) ||
        row.lastName.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const selectedCleaner = useMemo(
    () => filteredRows.find((row) => row.id === selectedCleanerId) || rows.find((row) => row.id === selectedCleanerId) || null,
    [filteredRows, rows, selectedCleanerId]
  );

  const cleanerDetailQuery = useQuery({
    queryKey: ["admin-cleaner-detail-table", selectedCleanerId],
    enabled: !!selectedCleanerId,
    queryFn: async () => {
      if (!selectedCleanerId) return null;
      const cleaner = await fetchCleanerById(selectedCleanerId);
      const resolvedId = resolveCleanerId(cleaner);
      return mapCleanerToOnboarding({ ...cleaner, id: resolvedId, profile: cleaner.profile as never });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      cleanerId,
      nextStatus,
      reason,
    }: {
      cleanerId: string;
      nextStatus: "APPROVED" | "REJECTED";
      reason?: string;
    }) => reviewCleanerOnboarding(cleanerId, nextStatus, reason),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-onboarding-table"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-cleaner-detail-table", variables.cleanerId] }),
      ]);
      toast.success(`Cleaner ${variables.cleanerId} ${variables.nextStatus.toLowerCase()} successfully.`);
      if (variables.nextStatus === "REJECTED") {
        setRejectTargetId(null);
        setRejectionReason("");
      }
    },
    onError: () => {
      toast.error("Failed to submit onboarding decision.");
    },
  });

  const allFilteredIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);
  const areAllFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedRows.includes(id));

  const toggleAll = () => {
    if (areAllFilteredSelected) {
      setSelectedRows((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
      return;
    }
    setSelectedRows((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
  };

  const pendingCount = rows.filter((row) => row.onboarding_status === "PENDING").length;
  const approvedCount = rows.filter((row) => row.onboarding_status === "APPROVED").length;
  const rejectedCount = rows.filter((row) => row.onboarding_status === "REJECTED").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto bg-white min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Employees Onboarding</h1>
          <p className="text-sm text-gray-500 mt-1">Single onboarding queue. Review pending cleaner profiles and decide approval.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => queueQuery.refetch()}
            disabled={queueQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <div className="flex items-center rounded-lg border bg-gray-50/50 p-1">
            <Badge variant="secondary" className="bg-transparent border-0 text-gray-700 font-medium px-3 h-7">
              {pendingCount} Pending
            </Badge>
            <Badge className="bg-[#e9f7ef] hover:bg-[#e9f7ef] text-[#22c55e] border-0 px-3 h-7 font-medium">
              {approvedCount} Approved
            </Badge>
            <Badge className="bg-[#fff4f4] hover:bg-[#fff4f4] text-[#ef4444] border-0 px-3 h-7 font-medium">
              {rejectedCount} Rejected
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or cleaner ID..."
            className="pl-10 h-10 border-gray-200 focus-visible:ring-[#22c55e]"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow className="hover:bg-transparent border-b-gray-100">
              <TableHead className="w-12 px-4">
                <Checkbox
                  checked={areAllFilteredSelected}
                  onCheckedChange={toggleAll}
                  className="rounded border-gray-300 data-[state=checked]:bg-[#22c55e] data-[state=checked]:border-[#22c55e]"
                />
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Cleaner</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Email</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Profile Checks</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Submitted</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Status</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queueQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-gray-500 px-4 py-6">
                  Loading onboarding queue...
                </TableCell>
              </TableRow>
            )}
            {queueQuery.isError && (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-red-500 px-4 py-6">
                  Failed to load onboarding queue.
                </TableCell>
              </TableRow>
            )}
            {!queueQuery.isLoading && !queueQuery.isError && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-gray-500 px-4 py-6">
                  No onboarding records found.
                </TableCell>
              </TableRow>
            )}
            {!queueQuery.isLoading &&
              !queueQuery.isError &&
              filteredRows.map((employee) => {
                const hasFlags = employee.flags.missing_profile || employee.flags.missing_document || employee.flags.missing_payout;
                return (
                  <TableRow key={employee.id} className="group hover:bg-gray-50/50 border-b-gray-100 transition-colors">
                    <TableCell className="px-4">
                      <Checkbox
                        checked={selectedRows.includes(employee.id)}
                        onCheckedChange={() => toggleRow(employee.id)}
                        className="rounded border-gray-300 data-[state=checked]:bg-[#22c55e] data-[state=checked]:border-[#22c55e]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{employee.firstName} {employee.lastName}</span>
                        <span className="text-[11px] text-gray-400 leading-tight font-mono-data">{employee.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Mail className="h-3.5 w-3.5" />
                        {employee.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasFlags ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>
                            {[
                              employee.flags.missing_profile && "profile",
                              employee.flags.missing_document && "ID",
                              employee.flags.missing_payout && "payout",
                            ]
                              .filter(Boolean)
                              .join(" / ")} missing
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#22c55e] font-medium">Complete</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateTime(employee.date_created)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(employee.onboarding_status)}>
                        {employee.onboarding_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-[#22c55e] hover:bg-[#e9f7ef]"
                          onClick={() => setSelectedCleanerId(employee.id)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {employee.onboarding_status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-[#22c55e] border-[#22c55e]/30 hover:bg-[#e9f7ef]"
                              disabled={reviewMutation.isPending}
                              onClick={() =>
                                reviewMutation.mutate({
                                  cleanerId: employee.id,
                                  nextStatus: "APPROVED",
                                })
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                              disabled={reviewMutation.isPending}
                              onClick={() => setRejectTargetId(employee.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!rejectTargetId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTargetId(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Cleaner</DialogTitle>
            <DialogDescription>Provide a clear reason so the cleaner can fix and resubmit.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Rejection reason (minimum 10 characters)..."
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTargetId(null);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reviewMutation.isPending || rejectionReason.trim().length < 10 || !rejectTargetId}
              onClick={() => {
                if (!rejectTargetId) return;
                reviewMutation.mutate({
                  cleanerId: rejectTargetId,
                  nextStatus: "REJECTED",
                  reason: rejectionReason.trim(),
                });
              }}
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCleanerId && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">Onboarding Detail</h2>
          {!selectedCleaner && (
            <div className="surface-card p-6">
              <p className="text-sm text-muted-foreground">Cleaner not found in current queue.</p>
            </div>
          )}
          {selectedCleaner && (
            <OnboardingDetail
              cleaner={cleanerDetailQuery.data || selectedCleaner}
              onBack={() => setSelectedCleanerId(null)}
              onDecision={(cleanerId, status, reason) =>
                reviewMutation.mutate({
                  cleanerId,
                  nextStatus: status,
                  reason,
                })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
