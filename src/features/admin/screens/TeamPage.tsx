"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus, Shield, CircleAlert } from "lucide-react";
import { createAdmin, deleteOwnAdminAccount, listAdmins } from "@/lib/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import type { AdminProfile } from "@/lib/api/types";

function resolveDisplayName(admin: AdminProfile): string {
  if (admin.full_name?.trim()) return admin.full_name;
  if (admin.email) return admin.email.split("@")[0];
  return admin.id;
}

function formatLastAuth(lastAuth?: number | null): string {
  if (!lastAuth) return "Never";
  return new Date(lastAuth * 1000).toLocaleString();
}

function exportInviteText(email: string) {
  return `Welcome to Admin Sentinel. Login with ${email} and complete credential setup in the security center.`;
}

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [start, setStart] = useState(0);
  const [stop] = useState(20);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });

  const adminsQuery = useQuery({
    queryKey: ["admins", { start, stop, search }],
    queryFn: () => listAdmins(start, stop),
  });

  const createMutation = useMutation({
    mutationFn: createAdmin,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setIsCreateOpen(false);
      setForm({ full_name: "", email: "", password: "" });
      if (created?.email) {
        navigator.clipboard
          .writeText(exportInviteText(created.email))
          .then(() => toast.success("Admin created. Invite note copied."))
          .catch(() => toast.success("Admin created successfully."));
      } else {
        toast.success("Admin created successfully.");
      }
    },
    onError: () => toast.error("Failed to create admin."),
  });

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
        admin.id.toLowerCase().includes(q) ||
        (admin.email || "").toLowerCase().includes(q) ||
        (admin.full_name || "").toLowerCase().includes(q)
      );
    });
  }, [adminsQuery.data, search]);

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tighter">Admin Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage admin access, invite new admins, and review account posture.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Admin</DialogTitle>
              <DialogDescription>Provision a new admin account with immediate access.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="full-name">Full Name</Label>
                <Input id="full-name" value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Temporary Password</Label>
                <Input id="password" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.full_name.trim() || !form.email.trim() || !form.password.trim()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {createMutation.isPending ? "Creating..." : "Create Admin"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, email, or name" className="sm:max-w-sm" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStart(Math.max(0, start - stop))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStart(start + stop)}>
              Next
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email Verified</TableHead>
                <TableHead>Last Auth</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="font-mono-data text-muted-foreground">
                    Loading admins...
                  </TableCell>
                </TableRow>
              )}
              {adminsQuery.isError && (
                <TableRow>
                  <TableCell colSpan={6} className="font-mono-data text-destructive">
                    Failed to fetch admins.
                  </TableCell>
                </TableRow>
              )}
              {!adminsQuery.isLoading && !adminsQuery.isError && filteredAdmins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No admins found for current filters.
                  </TableCell>
                </TableRow>
              )}
              {filteredAdmins.map((admin, index) => (
                <motion.tr
                  key={admin.id || `${admin.email}-${index}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-border"
                >
                  <TableCell className="font-medium">{resolveDisplayName(admin)}</TableCell>
                  <TableCell className="font-mono-data">{admin.email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={admin.accountStatus === "ACTIVE" ? "success" : "warning"}>{admin.accountStatus || "ACTIVE"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={admin.email_verified ? "success" : "secondary"}>{admin.email_verified ? "Verified" : "Pending"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatLastAuth(admin.last_auth_at)}</TableCell>
                  <TableCell className="font-mono-data text-xs">{admin.id}</TableCell>
                </motion.tr>
              ))}
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
                <Button variant="destructive" className="gap-2">
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
                    disabled={confirmText !== "DELETE MY ACCOUNT" || deleteMutation.isPending}
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
    </div>
  );
}
