"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  bulkSetAdminAccessPreset,
  inviteAdmin,
  listAccessPresets,
  listAdmins,
  resendAdminInvite,
  setAdminAccessPreset,
} from "@/lib/api/admin-api";
import type { AccessPresetBulkResult, AccessPresetSummary, AdminProfile } from "@/lib/api/types";

/**
 * Query keys for the admin-team feature. Every mutation below invalidates
 * `adminsKeys.all`, which prefix-matches every paginated list entry, so the
 * table always re-reads `GET /api/v1/admins` after a write.
 */
export const adminsKeys = {
  all: ["admins"] as const,
  list: (params: { limit: number; skip: number }) => ["admins", "list", params] as const,
  accessPresets: ["admin-access-presets"] as const,
};

/** Temp passwords are generated server-side and expire 72h after the invite is sent. */
export const TEMP_PASSWORD_TTL_COPY = "72 hours";

/**
 * `apiRequest` rejects with a plain `ApiError` object (not an `Error`
 * instance), so `instanceof Error` misses it. Read `message` structurally and
 * fall back to task-specific copy.
 */
function errorCopy(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

export function useAdmins(params: { limit: number; skip: number }) {
  return useQuery({
    queryKey: adminsKeys.list(params),
    queryFn: () => listAdmins(params),
  });
}

/**
 * The preset catalog is a static server-side table (`ADMIN_PRESETS`), so it is
 * cached hard — every row's picker and the invite dialog share this one fetch.
 */
export function useAccessPresets() {
  return useQuery<AccessPresetSummary[]>({
    queryKey: adminsKeys.accessPresets,
    queryFn: listAccessPresets,
    staleTime: 30 * 60_000,
  });
}

export function useInviteAdmin() {
  const queryClient = useQueryClient();

  return useMutation<AdminProfile, unknown, { fullName: string; email: string; accessPreset: string }>({
    mutationFn: (payload) => inviteAdmin(payload),
    onSuccess: (admin) => {
      queryClient.invalidateQueries({ queryKey: adminsKeys.all });
      toast.success(
        `Invite sent to ${admin.email}. We emailed them a temporary password — it expires in ${TEMP_PASSWORD_TTL_COPY}.`
      );
    },
    onError: (error) => toast.error(errorCopy(error, "Failed to send the invite.")),
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();

  return useMutation<AdminProfile, unknown, { adminId: string; name?: string }>({
    mutationFn: ({ adminId }) => resendAdminInvite(adminId),
    onSuccess: (admin, variables) => {
      queryClient.invalidateQueries({ queryKey: adminsKeys.all });
      toast.success(
        `Invite resent to ${variables.name || admin.email}. The new temporary password expires in ${TEMP_PASSWORD_TTL_COPY}.`
      );
    },
    onError: (error) => toast.error(errorCopy(error, "Failed to resend the invite.")),
  });
}

export function useSetAccessPreset() {
  const queryClient = useQueryClient();

  return useMutation<AdminProfile, unknown, { adminId: string; preset: string; label?: string; name?: string }>({
    mutationFn: ({ adminId, preset }) => setAdminAccessPreset(adminId, preset),
    onSuccess: (admin, variables) => {
      queryClient.invalidateQueries({ queryKey: adminsKeys.all });
      const who = variables.name || admin.email || "That admin";
      toast.success(`${who} is now on the ${variables.label || variables.preset} preset.`);
    },
    onError: (error) => toast.error(errorCopy(error, "Failed to change the access preset.")),
  });
}

/**
 * The backend applies each id independently and answers with
 * `{updated, skipped: [{id, reason}]}` — a partial success is the normal case
 * (self-changes and the last full-access admin are refused), so the toast
 * summarises and the caller renders the per-row reasons.
 */
export function useBulkSetAccessPreset() {
  const queryClient = useQueryClient();

  return useMutation<AccessPresetBulkResult, unknown, { adminIds: string[]; preset: string; label?: string }>({
    mutationFn: ({ adminIds, preset }) => bulkSetAdminAccessPreset(adminIds, preset),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminsKeys.all });
      const target = variables.label || variables.preset;
      if (result.skipped.length === 0) {
        toast.success(`${result.updated} admin${result.updated === 1 ? "" : "s"} moved to ${target}.`);
        return;
      }
      if (result.updated === 0) {
        toast.error(`No admins were changed — ${result.skipped.length} skipped.`);
        return;
      }
      toast.message(
        `${result.updated} admin${result.updated === 1 ? "" : "s"} moved to ${target}; ${result.skipped.length} skipped.`
      );
    },
    onError: (error) => toast.error(errorCopy(error, "Bulk preset change failed.")),
  });
}
