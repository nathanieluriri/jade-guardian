"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearAuthState, getAuthState, setAuthState } from "@/lib/api/auth-storage";
import { fetchAdminProfile, loginAdmin } from "@/lib/api/admin-api";

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
    onSuccess: (data) => {
      setAuthState({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-profile"] });
      router.replace("/admin/overview");
    },
  });
}

export function useAdminLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    clearAuthState();
    queryClient.clear();
    router.replace("/admin/login");
  };
}
