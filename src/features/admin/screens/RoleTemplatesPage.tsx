"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Trash2, Zap, CopyCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchPermissionCatalog, fetchRoleTemplate, rolloutRoleTemplate, updateRoleTemplate } from "@/lib/api/admin-api";
import type { Permission } from "@/lib/api/types";

function diffPermissions(current: Permission[], initial: Permission[]) {
  const currentSet = new Set(current.map((item) => item.key));
  const initialSet = new Set(initial.map((item) => item.key));

  const added = current.filter((item) => !initialSet.has(item.key));
  const removed = initial.filter((item) => !currentSet.has(item.key));

  return { added, removed };
}

function lintTemplatePermissions(current: Permission[], validCatalogKeys: Set<string>) {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const permission of current) {
    if (seen.has(permission.key)) warnings.push(`Duplicate permission key: ${permission.key}`);
    seen.add(permission.key);

    if (!validCatalogKeys.has(permission.key)) warnings.push(`Unknown catalog key: ${permission.key}`);
    if (!permission.path.startsWith("/")) warnings.push(`Invalid path shape (must start with /): ${permission.path}`);
    if (!permission.methods || permission.methods.length === 0) warnings.push(`Missing HTTP method for ${permission.name}`);
  }

  return warnings;
}

const BASELINE_RULES: Record<"cleaner" | "customer", string[]> = {
  cleaner: ["GET:/cleaners/me", "PUT:/cleaners/onboarding", "POST:/cleaners/sessions/logout"],
  customer: ["GET:/customers/me", "PATCH:/customers/me", "POST:/settings/sessions/logout"],
};

function AddFromCatalogDialog({
  role,
  currentPermissions,
  onSelect,
}: {
  role: "cleaner" | "customer";
  currentPermissions: Permission[];
  onSelect: (permission: Permission) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const catalogQuery = useQuery({ queryKey: ["permissions", "catalog"], queryFn: fetchPermissionCatalog });

  const existingKeys = useMemo(() => new Set(currentPermissions.map((item) => item.key)), [currentPermissions]);
  const searchQuery = search.trim().toLowerCase();
  const routes = useMemo(() => {
    const groups = catalogQuery.data?.grouped || [];
    return groups.flatMap((group) =>
      group.routes
        .filter((route) => {
          if (!searchQuery) return true;
          const haystack = `${route.resource} ${route.method} ${route.path} ${route.key} ${route.summary || ""}`.toLowerCase();
          return haystack.includes(searchQuery);
        })
        .map((route) => ({ ...route, resource: group.resource }))
    );
  }, [catalogQuery.data?.grouped, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add from catalog
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Permission - {role}</DialogTitle>
          <DialogDescription>
            Choose API endpoints from the live catalog. Existing permissions are disabled.
          </DialogDescription>
        </DialogHeader>

        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search method, path, key, description" />

        <ScrollArea className="h-[460px] pr-2">
          <div className="space-y-2 py-1">
            {catalogQuery.isLoading && <p className="font-mono-data text-muted-foreground">Loading catalog...</p>}
            {catalogQuery.isError && <p className="font-mono-data text-destructive">Failed to load catalog.</p>}
            {!catalogQuery.isLoading && !catalogQuery.isError && routes.length === 0 && (
              <p className="text-sm text-muted-foreground">No endpoints match your search.</p>
            )}
            {routes.map((route) => {
              const disabled = existingKeys.has(route.key);
              return (
                <div key={route.key} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono-data text-[10px]">{route.method}</Badge>
                    <span className="font-mono-data text-xs">{route.path}</span>
                    <Badge variant="secondary">{route.resource}</Badge>
                    {disabled && <Badge variant="success">Already in template</Badge>}
                  </div>
                  <p className="mt-1 font-mono-data text-xs text-muted-foreground">{route.key}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{route.summary || "No summary available"}</p>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => {
                        onSelect({
                          name: route.endpoint_name || route.key,
                          methods: [route.method],
                          path: route.normalized_path || route.path,
                          key: route.key,
                          description: route.summary,
                        });
                        setOpen(false);
                      }}
                    >
                      Add Permission
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function TemplateSection({
  role,
  source,
  permissions,
  initialPermissions,
  onUpdate,
  onRollout,
  onSave,
  warnings,
  saving,
  rollingOut,
}: {
  role: "cleaner" | "customer";
  source: string;
  permissions: Permission[];
  initialPermissions: Permission[];
  onUpdate: (perms: Permission[]) => void;
  onRollout: () => void;
  onSave: () => void;
  warnings: string[];
  saving: boolean;
  rollingOut: boolean;
}) {
  const [rolloutPhrase, setRolloutPhrase] = useState("");
  const isProduction = process.env.NODE_ENV === "production";
  const confirmationPhrase = `ROLLOUT ${role.toUpperCase()}`;

  const removePermission = (key: string) => {
    onUpdate(permissions.filter((p) => p.key !== key));
  };

  const addPermission = (perm: Permission) => {
    onUpdate([...permissions, perm]);
  };

  const { added, removed } = diffPermissions(permissions, initialPermissions);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[15px] font-semibold capitalize">{role} Template</h3>
          <Badge variant={source === "template" ? "info" : "secondary"}>{source || "default"}</Badge>
          <Badge variant="secondary" className="font-mono-data text-[10px]">{permissions.length} permissions</Badge>
          <Badge variant="outline">+{added.length} / -{removed.length} changes</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddFromCatalogDialog role={role} currentPermissions={permissions} onSelect={addPermission} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const baseline = BASELINE_RULES[role];
              const missing = baseline.filter((key) => !permissions.some((permission) => permission.key === key));
              if (missing.length === 0) {
                toast.info("Baseline already applied.");
                return;
              }

              const skeletons = missing.map((key) => {
                const [method, path] = key.split(":");
                return {
                  name: key,
                  methods: [method],
                  path,
                  key,
                  description: "Added from baseline quick action",
                } as Permission;
              });
              onUpdate([...permissions, ...skeletons]);
              toast.success(`Added ${skeletons.length} baseline permissions.`);
            }}
          >
            <CopyCheck className="h-3.5 w-3.5 mr-1.5" />
            Apply Baseline
          </Button>
          <Button size="sm" variant="default" className="gap-1.5" onClick={onSave} disabled={saving || warnings.length > 0}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="default" className="gap-1.5" disabled={rollingOut}>
                <Zap className="h-3.5 w-3.5" />
                {rollingOut ? "Rolling out..." : "Rollout"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permission Rollout - {role}</AlertDialogTitle>
                <AlertDialogDescription>
                  Dry-run preview: <span className="font-mono-data">{added.length} additions</span> and <span className="font-mono-data">{removed.length} removals</span> versus last loaded template.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 text-sm">
                {added.length > 0 && (
                  <p className="text-muted-foreground">
                    Added keys: <span className="font-mono-data">{added.slice(0, 3).map((item) => item.key).join(", ")}{added.length > 3 ? "..." : ""}</span>
                  </p>
                )}
                {removed.length > 0 && (
                  <p className="text-muted-foreground">
                    Removed keys: <span className="font-mono-data">{removed.slice(0, 3).map((item) => item.key).join(", ")}{removed.length > 3 ? "..." : ""}</span>
                  </p>
                )}
                {isProduction && (
                  <div className="space-y-1.5">
                    <Label htmlFor={`rollout-${role}`}>Type {confirmationPhrase}</Label>
                    <Input id={`rollout-${role}`} value={rolloutPhrase} onChange={(e) => setRolloutPhrase(e.target.value)} />
                  </div>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onRollout}
                  disabled={isProduction ? rolloutPhrase !== confirmationPhrase : false}
                >
                  Confirm Rollout
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="border-b border-border px-4 py-3 bg-warning/5">
          <p className="text-xs font-semibold text-warning mb-1">Policy lint warnings</p>
          <ul className="space-y-1">
            {warnings.map((warning) => (
              <li key={warning} className="text-xs text-muted-foreground">- {warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="divide-y divide-border">
        {permissions.map((perm) => (
          <motion.div
            key={`${perm.key}-${perm.path}`}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/50 transition-colors duration-150"
          >
            <div className="min-w-0">
              <span className="text-label text-foreground">{perm.name}</span>
              <p className="font-mono-data text-muted-foreground truncate">{perm.key}</p>
              {!!perm.description && <p className="text-xs text-muted-foreground">{perm.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="font-mono-data text-[10px]">
                {perm.methods.join(", ")}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => removePermission(perm.key)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function RoleTemplatesPage() {
  const queryClient = useQueryClient();

  const cleanerQuery = useQuery({ queryKey: ["role-template", "cleaner"], queryFn: () => fetchRoleTemplate("cleaner") });
  const customerQuery = useQuery({ queryKey: ["role-template", "customer"], queryFn: () => fetchRoleTemplate("customer") });
  const catalogQuery = useQuery({ queryKey: ["permissions", "catalog"], queryFn: fetchPermissionCatalog });

  const [cleanerPerms, setCleanerPerms] = useState<Permission[]>([]);
  const [customerPerms, setCustomerPerms] = useState<Permission[]>([]);
  const [initialCleanerPerms, setInitialCleanerPerms] = useState<Permission[]>([]);
  const [initialCustomerPerms, setInitialCustomerPerms] = useState<Permission[]>([]);
  const [receipt, setReceipt] = useState<{
    role: "cleaner" | "customer";
    matchedUsers: number;
    modifiedUsers: number;
    timestamp: string;
    actor: string;
  } | null>(null);

  useEffect(() => {
    if (cleanerQuery.data?.permissionList?.permissions) {
      setCleanerPerms(cleanerQuery.data.permissionList.permissions);
      setInitialCleanerPerms(cleanerQuery.data.permissionList.permissions);
    }
  }, [cleanerQuery.data]);

  useEffect(() => {
    if (customerQuery.data?.permissionList?.permissions) {
      setCustomerPerms(customerQuery.data.permissionList.permissions);
      setInitialCustomerPerms(customerQuery.data.permissionList.permissions);
    }
  }, [customerQuery.data]);

  const catalogKeys = useMemo(() => {
    const flat = catalogQuery.data?.flat?.permissions || [];
    return new Set(flat.map((item) => item.key).filter(Boolean) as string[]);
  }, [catalogQuery.data?.flat?.permissions]);

  const cleanerWarnings = useMemo(() => lintTemplatePermissions(cleanerPerms, catalogKeys), [catalogKeys, cleanerPerms]);
  const customerWarnings = useMemo(() => lintTemplatePermissions(customerPerms, catalogKeys), [catalogKeys, customerPerms]);

  const saveMutation = useMutation({
    mutationFn: ({ role, permissions }: { role: "cleaner" | "customer"; permissions: Permission[] }) =>
      updateRoleTemplate(role, { permissions }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["role-template", variables.role] });
      toast.success(`${variables.role} template saved.`);
    },
    onError: () => toast.error("Failed to save template."),
  });

  const rolloutMutation = useMutation({
    mutationFn: (role: "cleaner" | "customer") => rolloutRoleTemplate(role),
    onSuccess: (response, role) => {
      queryClient.invalidateQueries({ queryKey: ["role-template", role] });
      queryClient.invalidateQueries({ queryKey: ["permissions", "catalog"] });
      queryClient.invalidateQueries({ queryKey: ["role-rollout-impact", role] });
      queryClient.refetchQueries({ queryKey: ["role-template", role] });
      queryClient.refetchQueries({ queryKey: ["permissions", "catalog"] });

      const result = (response as { data?: { matched_users?: number; modified_users?: number; actor_id?: string } })?.data;
      setReceipt({
        role,
        matchedUsers: result?.matched_users ?? 0,
        modifiedUsers: result?.modified_users ?? 0,
        timestamp: new Date().toISOString(),
        actor: result?.actor_id || "current_admin",
      });

      toast.success(`${role} permission rollout completed.`);
    },
    onError: () => toast.error("Rollout failed."),
  });

  const loading = cleanerQuery.isLoading || customerQuery.isLoading;
  const hasError = cleanerQuery.isError || customerQuery.isError;

  const cleanerSource = useMemo(() => cleanerQuery.data?.source || "template", [cleanerQuery.data]);
  const customerSource = useMemo(() => customerQuery.data?.source || "default", [customerQuery.data]);

  return (
    <div className="space-y-6 max-w-[1080px]">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tighter">
        Role Permission Templates
      </motion.h1>

      {loading && <p className="font-mono-data text-muted-foreground">Loading role templates...</p>}
      {hasError && <p className="font-mono-data text-destructive">Failed to load role templates.</p>}

      {!loading && !hasError && (
        <>
          <TemplateSection
            role="cleaner"
            source={cleanerSource}
            permissions={cleanerPerms}
            initialPermissions={initialCleanerPerms}
            onUpdate={setCleanerPerms}
            onSave={() => saveMutation.mutate({ role: "cleaner", permissions: cleanerPerms })}
            onRollout={() => rolloutMutation.mutate("cleaner")}
            warnings={cleanerWarnings}
            saving={saveMutation.isPending}
            rollingOut={rolloutMutation.isPending}
          />
          <TemplateSection
            role="customer"
            source={customerSource}
            permissions={customerPerms}
            initialPermissions={initialCustomerPerms}
            onUpdate={setCustomerPerms}
            onSave={() => saveMutation.mutate({ role: "customer", permissions: customerPerms })}
            onRollout={() => rolloutMutation.mutate("customer")}
            warnings={customerWarnings}
            saving={saveMutation.isPending}
            rollingOut={rolloutMutation.isPending}
          />
        </>
      )}

      <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollout Receipt</DialogTitle>
            <DialogDescription>Post-rollout summary and cache refresh confirmation.</DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="space-y-2 text-sm">
              <p>Role: <span className="font-mono-data">{receipt.role}</span></p>
              <p>Matched users: <span className="font-mono-data">{receipt.matchedUsers}</span></p>
              <p>Modified users: <span className="font-mono-data">{receipt.modifiedUsers}</span></p>
              <p>Timestamp: <span className="font-mono-data">{new Date(receipt.timestamp).toLocaleString()}</span></p>
              <p>Actor: <span className="font-mono-data">{receipt.actor}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setReceipt(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
