"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearAuthState, getAuthState, setAuthState } from "@/lib/api/auth-storage";
import { fetchAdminProfile, loginAdmin, revokeCurrentSession } from "@/lib/api/admin-api";
import { resolveFirstAllowedAdminRoute } from "@/lib/admin-access";

export function useAdminProfile() {
  return useQuery({
    queryKey: ["admin-profile"],
    queryFn: fetchAdminProfile,
    enabled: !!getAuthState()?.accessToken,
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
      setAuthState({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
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
      // Best effort logout: clear local auth state even if revoke endpoint fails.
    }
    clearAuthState();
    queryClient.clear();
    router.replace("/admin/login");
  };
}
