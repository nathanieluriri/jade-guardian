"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Trash2, Zap, CopyCheck, ScanSearch } from "lucide-react";
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
import {
  fetchPermissionCatalog,
  fetchRoleTemplate,
  getRoleRolloutImpact,
  previewRoleTemplate,
  rolloutRoleTemplate,
  updateRoleTemplate,
} from "@/lib/api/admin-api";
import type { Permission, RoleTemplatePreviewResult, RoleTemplateRolloutImpact } from "@/lib/api/types";
import { AdminLoadingState } from "@/components/AdminLoadingState";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { canAccessAdminAction } from "@/lib/admin-access";

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

function normalizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const permission = item as Partial<Permission>;
      if (!permission.key || !permission.path) return null;
      return {
        name: permission.name || permission.key,
        key: permission.key,
        methods: Array.isArray(permission.methods) ? permission.methods.filter(Boolean) : [],
        path: permission.path,
        description: permission.description,
      } as Permission;
    })
    .filter((item): item is Permission => item !== null);
}

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
    const groups = Array.isArray(catalogQuery.data?.grouped) ? catalogQuery.data.grouped : [];
    return groups.flatMap((group) =>
      (Array.isArray(group?.routes) ? group.routes : [])
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
          <DialogDescription>Choose API endpoints from live catalog.</DialogDescription>
        </DialogHeader>

        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search method, path, key, summary" />

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

function PreviewDialog({
  role,
  open,
  onOpenChange,
  preview,
  impact,
  loading,
}: {
  role: "cleaner" | "customer";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: RoleTemplatePreviewResult | null;
  impact: RoleTemplateRolloutImpact | null;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role} Template Preview</DialogTitle>
          <DialogDescription>Preview output + rollout impact from backend UX endpoints.</DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading preview...</p>}
        {!loading && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border p-3">
              <p>Additions: <span className="font-mono-data">{preview?.additions ?? 0}</span></p>
              <p>Removals: <span className="font-mono-data">{preview?.removals ?? 0}</span></p>
              <p>Warnings: <span className="font-mono-data">{preview?.warnings?.length ?? 0}</span></p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p>Matched users: <span className="font-mono-data">{impact?.matched_users ?? 0}</span></p>
              <p>Modified users: <span className="font-mono-data">{impact?.modified_users ?? 0}</span></p>
            </div>
            {!!preview?.changed_keys?.length && (
              <p className="text-muted-foreground">Changed keys: {preview.changed_keys.slice(0, 8).join(", ")}{preview.changed_keys.length > 8 ? "..." : ""}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
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
  onPreview,
  warnings,
  saving,
  rollingOut,
  previewing,
  preview,
  impact,
  canSave,
  canPreview,
  canRollout,
}: {
  role: "cleaner" | "customer";
  source: string;
  permissions: Permission[];
  initialPermissions: Permission[];
  onUpdate: (perms: Permission[]) => void;
  onRollout: () => void;
  onSave: () => void;
  onPreview: () => void;
  warnings: string[];
  saving: boolean;
  rollingOut: boolean;
  previewing: boolean;
  preview: RoleTemplatePreviewResult | null;
  impact: RoleTemplateRolloutImpact | null;
  canSave: boolean;
  canPreview: boolean;
  canRollout: boolean;
}) {
  const [rolloutPhrase, setRolloutPhrase] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const isProduction = process.env.NODE_ENV === "production";
  const confirmationPhrase = `ROLLOUT ${role.toUpperCase()}`;

  const removePermission = (index: number) => {
    onUpdate(permissions.filter((_, currentIndex) => currentIndex !== index));
  };

  const addPermission = (perm: Permission) => {
    onUpdate([...permissions, perm]);
  };

  const { added, removed } = diffPermissions(permissions, initialPermissions);

  return (
    <div className="surface-card">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[15px] font-semibold capitalize">{role} Template</h3>
          <Badge variant={source === "template" ? "info" : "secondary"}>{source || "default"}</Badge>
          <Badge variant="secondary" className="font-mono-data text-[10px]">{permissions.length} permissions</Badge>
          <Badge variant="outline">+{added.length} / -{removed.length} changes</Badge>
          {impact && <Badge variant="outline">Impact: {impact.matched_users ?? 0} matched</Badge>}
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
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              onPreview();
              setPreviewOpen(true);
            }}
            disabled={previewing || !canPreview}
          >
            <ScanSearch className="h-3.5 w-3.5 mr-1.5" />
            {previewing ? "Previewing..." : "Preview"}
          </Button>
          <Button size="sm" variant="default" className="gap-1.5" onClick={onSave} disabled={saving || warnings.length > 0 || !canSave}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="default" className="gap-1.5" disabled={rollingOut || !canRollout}>
                <Zap className="h-3.5 w-3.5" />
                {rollingOut ? "Rolling out..." : "Rollout"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permission Rollout - {role}</AlertDialogTitle>
                <AlertDialogDescription>
                  Preview: <span className="font-mono-data">{added.length} additions</span>, <span className="font-mono-data">{removed.length} removals</span>. Impact: <span className="font-mono-data">{impact?.matched_users ?? 0} matched</span>, <span className="font-mono-data">{impact?.modified_users ?? 0} modified</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {isProduction && (
                <div className="space-y-1.5">
                  <Label htmlFor={`rollout-${role}`}>Type {confirmationPhrase}</Label>
                  <Input id={`rollout-${role}`} value={rolloutPhrase} onChange={(e) => setRolloutPhrase(e.target.value)} />
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRollout} disabled={(isProduction ? rolloutPhrase !== confirmationPhrase : false) || !canRollout}>
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
        {permissions.map((perm, index) => (
          <motion.div
            key={`${perm.key}-${perm.path}-${index}`}
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
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="font-mono-data text-[10px]">{perm.methods.join(", ")}</Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => removePermission(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      <PreviewDialog role={role} open={previewOpen} onOpenChange={setPreviewOpen} preview={preview} impact={impact} loading={previewing} />
    </div>
  );
}

export default function RoleTemplatesPage() {
  const queryClient = useQueryClient();
  const profileQuery = useAdminProfile();

  const cleanerQuery = useQuery({
    queryKey: ["role-template", "cleaner"],
    queryFn: () => fetchRoleTemplate("cleaner"),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
  const customerQuery = useQuery({
    queryKey: ["role-template", "customer"],
    queryFn: () => fetchRoleTemplate("customer"),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
  const catalogQuery = useQuery({
    queryKey: ["permissions", "catalog"],
    queryFn: fetchPermissionCatalog,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const cleanerImpactQuery = useQuery({
    queryKey: ["role-rollout-impact", "cleaner"],
    queryFn: () => getRoleRolloutImpact("cleaner"),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
  const customerImpactQuery = useQuery({
    queryKey: ["role-rollout-impact", "customer"],
    queryFn: () => getRoleRolloutImpact("customer"),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const [cleanerPerms, setCleanerPerms] = useState<Permission[]>([]);
  const [customerPerms, setCustomerPerms] = useState<Permission[]>([]);
  const [initialCleanerPerms, setInitialCleanerPerms] = useState<Permission[]>([]);
  const [initialCustomerPerms, setInitialCustomerPerms] = useState<Permission[]>([]);
  const [cleanerPreview, setCleanerPreview] = useState<RoleTemplatePreviewResult | null>(null);
  const [customerPreview, setCustomerPreview] = useState<RoleTemplatePreviewResult | null>(null);
  const hasInitializedCleanerRef = useRef(false);
  const hasInitializedCustomerRef = useRef(false);
  const [cleanerDirty, setCleanerDirty] = useState(false);
  const [customerDirty, setCustomerDirty] = useState(false);

  useEffect(() => {
    if (!cleanerQuery.data) return;
    if (hasInitializedCleanerRef.current && cleanerDirty) return;
    const nextPermissions = normalizePermissions(cleanerQuery.data.permissionList?.permissions);
    setCleanerPerms(nextPermissions);
    setInitialCleanerPerms(nextPermissions);
    hasInitializedCleanerRef.current = true;
    setCleanerDirty(false);
  }, [cleanerDirty, cleanerQuery.data]);

  useEffect(() => {
    if (!customerQuery.data) return;
    if (hasInitializedCustomerRef.current && customerDirty) return;
    const nextPermissions = normalizePermissions(customerQuery.data.permissionList?.permissions);
    setCustomerPerms(nextPermissions);
    setInitialCustomerPerms(nextPermissions);
    hasInitializedCustomerRef.current = true;
    setCustomerDirty(false);
  }, [customerDirty, customerQuery.data]);

  const handleCleanerUpdate = (nextPermissions: Permission[]) => {
    setCleanerPerms(nextPermissions);
    setCleanerDirty(true);
  };

  const handleCustomerUpdate = (nextPermissions: Permission[]) => {
    setCustomerPerms(nextPermissions);
    setCustomerDirty(true);
  };

  const catalogKeys = useMemo(() => {
    const flat = Array.isArray(catalogQuery.data?.flat?.permissions) ? catalogQuery.data.flat.permissions : [];
    return new Set(flat.map((item) => item.key).filter(Boolean) as string[]);
  }, [catalogQuery.data?.flat?.permissions]);

  const cleanerWarnings = useMemo(() => lintTemplatePermissions(cleanerPerms, catalogKeys), [catalogKeys, cleanerPerms]);
  const customerWarnings = useMemo(() => lintTemplatePermissions(customerPerms, catalogKeys), [catalogKeys, customerPerms]);

  const saveMutation = useMutation({
    mutationFn: ({ role, permissions }: { role: "cleaner" | "customer"; permissions: Permission[] }) =>
      updateRoleTemplate(role, { permissions }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["role-template", variables.role] });
      queryClient.invalidateQueries({ queryKey: ["role-rollout-impact", variables.role] });
      if (variables.role === "cleaner") {
        setInitialCleanerPerms(variables.permissions);
        setCleanerDirty(false);
      } else {
        setInitialCustomerPerms(variables.permissions);
        setCustomerDirty(false);
      }
      toast.success(`${variables.role} template saved.`);
    },
    onError: () => toast.error("Failed to save template."),
  });

  const previewMutation = useMutation({
    mutationFn: ({ role, permissions }: { role: "cleaner" | "customer"; permissions: Permission[] }) =>
      previewRoleTemplate(role, { permissions }),
    onSuccess: (result, variables) => {
      if (variables.role === "cleaner") setCleanerPreview(result);
      else setCustomerPreview(result);
    },
    onError: () => toast.error("Failed to preview template."),
  });

  const rolloutMutation = useMutation({
    mutationFn: (role: "cleaner" | "customer") => rolloutRoleTemplate(role),
    onSuccess: (_, role) => {
      queryClient.invalidateQueries({ queryKey: ["role-template", role] });
      queryClient.invalidateQueries({ queryKey: ["permissions", "catalog"] });
      queryClient.invalidateQueries({ queryKey: ["role-rollout-impact", role] });
      toast.success(`${role} permission rollout completed.`);
    },
    onError: () => toast.error("Rollout failed."),
  });

  const loading = cleanerQuery.isLoading || customerQuery.isLoading;
  const hasError = cleanerQuery.isError || customerQuery.isError;

  const cleanerSource = useMemo(() => cleanerQuery.data?.source || "template", [cleanerQuery.data]);
  const customerSource = useMemo(() => customerQuery.data?.source || "default", [customerQuery.data]);
  const canSaveCleaner = canAccessAdminAction({ method: "PUT", path: "/v1/admins/permission-templates/cleaner" }, profileQuery.data);
  const canSaveCustomer = canAccessAdminAction({ method: "PUT", path: "/v1/admins/permission-templates/customer" }, profileQuery.data);
  const canPreviewCleaner = canAccessAdminAction({ method: "POST", path: "/v1/admins/permission-templates/cleaner/preview" }, profileQuery.data);
  const canPreviewCustomer = canAccessAdminAction({ method: "POST", path: "/v1/admins/permission-templates/customer/preview" }, profileQuery.data);
  const canRolloutCleaner = canAccessAdminAction({ method: "POST", path: "/v1/admins/permission-templates/cleaner/rollout" }, profileQuery.data);
  const canRolloutCustomer = canAccessAdminAction({ method: "POST", path: "/v1/admins/permission-templates/customer/rollout" }, profileQuery.data);

  return (
    <div className="space-y-6 max-w-[1080px]">
      <h1 className="text-2xl font-semibold tracking-tighter">
        Role Permission Templates
      </h1>

      {loading && <AdminLoadingState label="Loading role templates..." />}
      {hasError && <p className="font-mono-data text-destructive">Failed to load role templates.</p>}

      {!loading && !hasError && (
        <>
          <TemplateSection
            role="cleaner"
            source={cleanerSource}
            permissions={cleanerPerms}
            initialPermissions={initialCleanerPerms}
            onUpdate={handleCleanerUpdate}
            onSave={() => saveMutation.mutate({ role: "cleaner", permissions: cleanerPerms })}
            onPreview={() => previewMutation.mutate({ role: "cleaner", permissions: cleanerPerms })}
            onRollout={() => rolloutMutation.mutate("cleaner")}
            warnings={cleanerWarnings}
            saving={saveMutation.isPending}
            previewing={previewMutation.isPending}
            rollingOut={rolloutMutation.isPending}
            preview={cleanerPreview}
            impact={cleanerImpactQuery.data || null}
            canSave={canSaveCleaner}
            canPreview={canPreviewCleaner}
            canRollout={canRolloutCleaner}
          />
          <TemplateSection
            role="customer"
            source={customerSource}
            permissions={customerPerms}
            initialPermissions={initialCustomerPerms}
            onUpdate={handleCustomerUpdate}
            onSave={() => saveMutation.mutate({ role: "customer", permissions: customerPerms })}
            onPreview={() => previewMutation.mutate({ role: "customer", permissions: customerPerms })}
            onRollout={() => rolloutMutation.mutate("customer")}
            warnings={customerWarnings}
            saving={saveMutation.isPending}
            previewing={previewMutation.isPending}
            rollingOut={rolloutMutation.isPending}
            preview={customerPreview}
            impact={customerImpactQuery.data || null}
            canSave={canSaveCustomer}
            canPreview={canPreviewCustomer}
            canRollout={canRolloutCustomer}
          />
        </>
      )}
    </div>
  );
}
