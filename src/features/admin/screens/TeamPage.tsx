"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { KeyRound, MailPlus, Trash2, Shield, CircleAlert, UserPlus } from "lucide-react";
import { deleteOwnAdminAccount } from "@/lib/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/recipes/confirm-dialog";
import type { AccessPresetBulkResult, AdminProfile } from "@/lib/api/types";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { canAccessAdminAction } from "@/lib/admin-access";
import { AccessPresetSelect } from "@/features/admins/components/access-preset-select";
import { InviteAdminDialog } from "@/features/admins/components/invite-admin-dialog";
import {
  useAccessPresets,
  useAdmins,
  useBulkSetAccessPreset,
  useResendInvite,
  useSetAccessPreset,
} from "@/features/admins/hooks/use-admins";

function resolveAdminId(admin: Partial<AdminProfile>): string {
  if (typeof admin.id === "string" && admin.id.trim()) return admin.id;
  return "unknown";
}

/**
 * The backend's `AdminOut` carries `firstName`/`lastName` — there is no
 * `full_name` on the wire, so the name is joined here. Email and id are
 * fallbacks for a partial row, never invented display data.
 */
function resolveDisplayName(admin: AdminProfile): string {
  const name = `${admin.firstName || ""} ${admin.lastName || ""}`.trim();
  if (name) return name;
  return admin.email?.trim() || resolveAdminId(admin);
}

export default function TeamPage() {
  const profileQuery = useAdminProfile();
  const { confirm, confirmDialog } = useConfirm();
  const [skip, setSkip] = useState(0);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPreset, setBulkPreset] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<AccessPresetBulkResult | null>(null);

  // Everything on this page that writes to another admin's account sits behind
  // the invite permission — the backend grants admin-account management as one
  // bundle, so a caller without it would only get dead controls.
  const canManageAdmins = canAccessAdminAction({ method: "POST", path: "/v1/admins/invites" }, profileQuery.data);
  const canDeleteOwnAccount = canAccessAdminAction({ method: "DELETE", path: "/v1/admins/account" }, profileQuery.data);
  const currentAdminId = profileQuery.data?.id ?? null;

  const adminsQuery = useAdmins({ skip, limit });
  const presetsQuery = useAccessPresets();
  const presets = presetsQuery.data ?? [];

  const resendMutation = useResendInvite();
  const setPresetMutation = useSetAccessPreset();
  const bulkPresetMutation = useBulkSetAccessPreset();

  const deleteMutation = useMutation({
    mutationFn: deleteOwnAdminAccount,
    onSuccess: () => {
      toast.success("Your admin account was deleted.");
      setConfirmText("");
    },
    onError: () => toast.error("Failed to delete your account."),
  });

  const filteredAdmins = useMemo(() => {
    const all = adminsQuery.data || [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((admin) => {
      return (
        resolveAdminId(admin).toLowerCase().includes(q) ||
        (admin.email || "").toLowerCase().includes(q) ||
        resolveDisplayName(admin).toLowerCase().includes(q)
      );
    });
  }, [adminsQuery.data, search]);

  const presetLabel = (key: string | null) => presets.find((preset) => preset.key === key)?.label || key || "No preset";

  const nameForId = (id: string) => {
    const match = (adminsQuery.data || []).find((admin) => resolveAdminId(admin) === id);
    return match ? resolveDisplayName(match) : id;
  };

  // Read the selection back off the rendered rows so the bulk payload always
  // follows table order regardless of the order the boxes were ticked in.
  const selectedAdmins = filteredAdmins.filter((admin) => selectedIds.includes(resolveAdminId(admin)));
  const allVisibleSelected = filteredAdmins.length > 0 && selectedAdmins.length === filteredAdmins.length;

  const toggleRow = (adminId: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, adminId])] : prev.filter((id) => id !== adminId)));
  };

  const toggleAllVisible = (checked: boolean) => {
    const visibleIds = filteredAdmins.map((admin) => resolveAdminId(admin));
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, ...visibleIds])] : prev.filter((id) => !visibleIds.includes(id))
    );
  };

  /**
   * The row picker used to fire the PATCH on selection, which made a one-click
   * re-scope of someone else's account indistinguishable from browsing the list.
   * The backend refuses the genuinely dangerous cases, but a preset swap still
   * revokes whatever the old preset granted and the new one doesn't, so it gets a
   * confirm step. The bulk bar already has its own explicit apply button.
   */
  const changeRowPreset = async (adminId: string, preset: string, displayName: string) => {
    const label = presetLabel(preset);
    const confirmed = await confirm({
      title: `Change ${displayName} to “${label}”?`,
      description:
        "Their permissions are replaced by exactly that preset — anything their current preset allows and this one doesn't is revoked on their next request.",
      confirmLabel: "Change preset",
      cancelLabel: "Keep current preset",
      tone: "destructive",
    });
    if (!confirmed) return;
    setPresetMutation.mutate({ adminId, preset, label, name: displayName });
  };

  const applyBulkPreset = async () => {
    if (!bulkPreset || selectedAdmins.length === 0) return;
    setBulkResult(null);
    const adminIds = selectedAdmins.map((admin) => resolveAdminId(admin));
    try {
      const result = await bulkPresetMutation.mutateAsync({
        adminIds,
        preset: bulkPreset,
        label: presetLabel(bulkPreset),
      });
      setBulkResult(result);
      // Keep only the rows the backend refused so a retry targets exactly them.
      setSelectedIds(result.skipped.map((entry) => entry.id));
    } catch {
      // The hook toasts the failure; the selection stays put for a retry.
    }
  };

  const columnCount = canManageAdmins ? 8 : 6;

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tighter">Admin Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite admins, re-scope their access preset, and review 2FA posture.
          </p>
        </div>
        {canManageAdmins && (
          <Button className="gap-2" onClick={() => setIsInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Invite admin
          </Button>
        )}
      </div>

      {canManageAdmins && (
        <InviteAdminDialog
          open={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          presets={presets}
          isLoadingPresets={presetsQuery.isLoading}
        />
      )}

      <div className="surface-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, email, or name"
            className="sm:max-w-sm"
            aria-label="Search admins"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSkip(Math.max(0, skip - limit))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSkip(skip + limit)}>
              Next
            </Button>
          </div>
        </div>

        {canManageAdmins && selectedAdmins.length > 0 && (
          <div
            role="region"
            aria-label="Bulk preset assignment"
            className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium">{`${selectedAdmins.length} selected`}</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <AccessPresetSelect
                presets={presets}
                isLoading={presetsQuery.isLoading}
                value={bulkPreset}
                onValueChange={setBulkPreset}
                ariaLabel="Access preset for selected admins"
                size="sm"
              />
              <Button
                size="sm"
                className="gap-2"
                disabled={!bulkPreset || bulkPresetMutation.isPending}
                onClick={applyBulkPreset}
              >
                <KeyRound className="h-4 w-4" />
                {`Change preset for ${selectedAdmins.length} selected`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedIds([]);
                  setBulkResult(null);
                }}
              >
                Clear selection
              </Button>
            </div>
          </div>
        )}

        {canManageAdmins && bulkResult && (
          <div role="status" className="mt-3 rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">{`${bulkResult.updated} updated, ${bulkResult.skipped.length} skipped`}</p>
            {bulkResult.skipped.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {bulkResult.skipped.map((entry) => (
                  <li key={entry.id}>{`${nameForId(entry.id)} — ${entry.reason}`}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canManageAdmins && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : selectedAdmins.length > 0 ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                      aria-label="Select all admins"
                    />
                  </TableHead>
                )}
                <TableHead>Admin</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Access preset</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ID</TableHead>
                {canManageAdmins && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={columnCount} className="font-mono-data text-muted-foreground">
                    Loading admins...
                  </TableCell>
                </TableRow>
              )}
              {adminsQuery.isError && (
                <TableRow>
                  <TableCell colSpan={columnCount} className="font-mono-data text-destructive">
                    Failed to fetch admins.
                  </TableCell>
                </TableRow>
              )}
              {!adminsQuery.isLoading && !adminsQuery.isError && filteredAdmins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-muted-foreground">
                    No admins found for current filters.
                  </TableCell>
                </TableRow>
              )}
              {filteredAdmins.map((admin, index) => {
                const adminId = resolveAdminId(admin);
                const displayName = resolveDisplayName(admin);
                const isSelected = selectedIds.includes(adminId);

                return (
                  <motion.tr
                    key={`${adminId}-${admin.email || "no-email"}-${index}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-b border-border"
                  >
                    {canManageAdmins && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleRow(adminId, checked === true)}
                          aria-label={`Select ${displayName}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>
                          {displayName}
                          {currentAdminId === adminId && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">You</span>
                          )}
                        </span>
                        {admin.mustChangePassword && (
                          <Badge variant="warning" className="w-fit">
                            Invite pending
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono-data">{admin.email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={admin.accessPreset ? "info" : "secondary"}>
                          {presetLabel(admin.accessPreset)}
                        </Badge>
                        {canManageAdmins && (
                          <AccessPresetSelect
                            presets={presets}
                            isLoading={presetsQuery.isLoading}
                            value={admin.accessPreset}
                            triggerLabel="Change preset"
                            ariaLabel={`Access preset for ${displayName}`}
                            size="sm"
                            disabled={setPresetMutation.isPending}
                            onValueChange={(preset) =>
                              void changeRowPreset(adminId, preset, displayName)
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin.totpEnabled ? "success" : "secondary"}>
                        {admin.totpEnabled ? "On" : "Off"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin.accountStatus === "ACTIVE" ? "success" : "warning"}>
                        {admin.accountStatus || "ACTIVE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono-data text-xs">{adminId}</TableCell>
                    {canManageAdmins && (
                      <TableCell>
                        {admin.mustChangePassword && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            aria-label={`Resend invite to ${displayName}`}
                            disabled={resendMutation.isPending}
                            onClick={() => resendMutation.mutate({ adminId, name: displayName })}
                          >
                            <MailPlus className="h-4 w-4" />
                            Resend invite
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-destructive/10 text-destructive flex items-center justify-center">
            <Shield className="h-4 w-4" />
          </div>
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Self Account Actions</h2>
              <p className="text-sm text-muted-foreground">
                Deleting your account revokes your current privileges. This action is not reversible.
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2" disabled={!canDeleteOwnAccount}>
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Your Admin Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    Type <span className="font-mono-data">DELETE MY ACCOUNT</span> to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="confirm-delete">Confirmation Text</Label>
                  <Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CircleAlert className="h-3.5 w-3.5" />
                    If password/OTP confirmation becomes available in backend, wire it here.
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={confirmText !== "DELETE MY ACCOUNT" || deleteMutation.isPending || !canDeleteOwnAccount}
                    onClick={() => deleteMutation.mutate()}
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete Account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
