"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearAuthHint, hasAuthHint, setAuthHint } from "@/lib/api/auth-storage";
import { fetchAdminProfile, loginAdmin, revokeCurrentSession } from "@/lib/api/admin-api";
import { resolveFirstAllowedAdminRoute } from "@/lib/admin-access";

export function useAdminProfile() {
  return useQuery({
    queryKey: ["admin-profile"],
    queryFn: fetchAdminProfile,
    enabled: hasAuthHint(),
    staleTime: 60_000,
  });
}

export function useAdminLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginAdmin(email, password),
    onSuccess: async (data) => {
      if ("otpRequired" in data && data.otpRequired) {
        // OTP challenges are driven by the dedicated login-flow hook; this
        // legacy mutation only handles the direct (no-OTP) success path.
        return;
      }

      setAuthHint();
      queryClient.invalidateQueries({ queryKey: ["admin-profile"] });
      try {
        const profile = await queryClient.fetchQuery({
          queryKey: ["admin-profile"],
          queryFn: fetchAdminProfile,
        });
        router.replace(resolveFirstAllowedAdminRoute(profile));
      } catch {
        router.replace("/admin/access");
      }
    },
  });
}

export function useAdminLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    try {
      await revokeCurrentSession();
    } catch {
      // Best effort logout: clear the local auth hint even if revoke fails.
    }
    clearAuthHint();
    queryClient.clear();
    router.replace("/admin/login");
  };
}
