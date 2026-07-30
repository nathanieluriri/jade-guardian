"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearAuthHint, hasAuthHint, setAuthHint } from "@/lib/api/auth-storage";
import {
  changeAdminPassword,
  fetchAdminProfile,
  loginAdmin,
  logoutAdmin,
  verifyAdminOtp,
} from "@/lib/api/admin-api";
import { resolveFirstAllowedAdminRoute } from "@/lib/admin-access";
import { adminAuthErrorCopy } from "@/lib/api/auth-errors";
import type { ApiError } from "@/lib/api/types";

const ADMIN_PROFILE_QUERY_KEY = ["admin-profile"];

export type LoginStep =
  | { kind: "credentials" }
  | { kind: "otp"; challengeId: string; method: "email" | "totp"; email: string };

export function useAdminProfile() {
  return useQuery({
    queryKey: ADMIN_PROFILE_QUERY_KEY,
    queryFn: fetchAdminProfile,
    enabled: hasAuthHint(),
    staleTime: 60_000,
  });
}

/**
 * Drives the two-state admin login flow: credentials, then (almost always)
 * an OTP challenge. No auth hint is set until the OTP is verified — the
 * challenge step alone never grants a session.
 */
export function useAdminLoginFlow() {
  const [step, setStep] = useState<LoginStep>({ kind: "credentials" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const completeLogin = useCallback(async () => {
    setAuthHint();
    queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_QUERY_KEY });
    try {
      const profile = await queryClient.fetchQuery({
        queryKey: ADMIN_PROFILE_QUERY_KEY,
        queryFn: fetchAdminProfile,
      });
      router.replace(profile.mustChangePassword ? "/admin/change-password" : resolveFirstAllowedAdminRoute(profile));
    } catch {
      router.replace("/admin/access");
    }
  }, [queryClient, router]);

  const submitCredentials = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      setError(null);
      setIsPending(true);
      try {
        const data = await loginAdmin(email, password);
        if ("otpRequired" in data && data.otpRequired) {
          setStep({ kind: "otp", challengeId: data.otpChallengeId, method: data.method, email });
          return;
        }

        // Legacy (ADMIN_OTP_REQUIRED=false) response: login already completed.
        await completeLogin();
      } catch (err) {
        setError(adminAuthErrorCopy(err as ApiError));
      } finally {
        setIsPending(false);
      }
    },
    [completeLogin]
  );

  const submitOtp = useCallback(
    async (code: string) => {
      if (step.kind !== "otp") return;
      setError(null);
      setIsPending(true);
      try {
        await verifyAdminOtp(step.challengeId, code);
        await completeLogin();
      } catch (err) {
        const apiError = err as ApiError;
        if (apiError.code === "OTP_LOCKED") {
          // The challenge is burned after 5 attempts; only a fresh login
          // (new challenge) can recover, so drop back to credentials.
          setStep({ kind: "credentials" });
        }
        setError(adminAuthErrorCopy(apiError));
      } finally {
        setIsPending(false);
      }
    },
    [step, completeLogin]
  );

  const backToCredentials = useCallback(() => {
    setError(null);
    setStep({ kind: "credentials" });
  }, []);

  return { step, submitCredentials, submitOtp, backToCredentials, error, isPending };
}

export function useAdminLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    try {
      await logoutAdmin();
    } catch {
      // Best effort logout: clear the local auth hint even if the request fails.
    }
    clearAuthHint();
    queryClient.clear();
    router.replace("/admin/login");
  };
}

/**
 * Mutation for the `mustChangePassword` gate and the settings screen alike.
 * On success the profile is force-refetched so `mustChangePassword` flips to
 * false wherever it's read (route guard, redirect decision).
 */
export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changeAdminPassword(currentPassword, newPassword),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_QUERY_KEY });
      await queryClient.fetchQuery({
        queryKey: ADMIN_PROFILE_QUERY_KEY,
        queryFn: fetchAdminProfile,
      });
    },
  });
}
