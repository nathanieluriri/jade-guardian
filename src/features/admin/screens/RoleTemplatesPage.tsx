"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { fetchRoleTemplate, rolloutRoleTemplate, updateRoleTemplate } from "@/lib/api/admin-api";
import type { Permission } from "@/lib/api/types";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function AddPermissionSheet({ onAdd }: { onAdd: (perm: Permission) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [methods, setMethods] = useState<string[]>([]);

  const toggleMethod = (method: string) => {
    setMethods((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]));
  };

  const computedKey = methods.length > 0 && path ? `${methods.join(",")}:${path}` : "";

  const handleSave = () => {
    if (!name.trim() || !path.trim() || methods.length === 0) return;
    onAdd({ name: name.trim(), path: path.trim(), methods: [...methods], key: computedKey });
    setName("");
    setPath("");
    setMethods([]);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Permission
          </Button>
        </motion.div>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add Permission</SheetTitle>
          <SheetDescription>Define a new permission to add to this role template.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 mt-6">
          <div className="space-y-2">
            <Label>Permission Name</Label>
            <Input placeholder="e.g. cleaner_schedule_read" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>HTTP Methods</Label>
            <div className="flex flex-wrap gap-3">
              {HTTP_METHODS.map((method) => (
                <div key={method} className="flex items-center gap-2">
                  <Checkbox id={`method-${method}`} checked={methods.includes(method)} onCheckedChange={() => toggleMethod(method)} />
                  <Label htmlFor={`method-${method}`} className="font-mono-data cursor-pointer">
                    {method}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Path</Label>
            <Input placeholder="e.g. /cleaners/schedule" value={path} onChange={(e) => setPath(e.target.value)} />
          </div>

          {computedKey && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="surface-card p-3">
              <p className="text-label text-muted-foreground mb-1">Auto-generated Key</p>
              <p className="font-mono-data text-foreground">{computedKey}</p>
            </motion.div>
          )}

          <motion.div whileTap={{ scale: 0.97 }}>
            <Button onClick={handleSave} disabled={!name.trim() || !path.trim() || methods.length === 0} className="w-full">
              <Plus className="h-4 w-4 mr-1.5" />
              Add to Template
            </Button>
          </motion.div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TemplateSection({
  role,
  source,
  permissions,
  onUpdate,
  onRollout,
  onSave,
}: {
  role: "cleaner" | "customer";
  source: string;
  permissions: Permission[];
  onUpdate: (perms: Permission[]) => void;
  onRollout: () => void;
  onSave: () => void;
}) {
  const removePermission = (key: string) => {
    onUpdate(permissions.filter((p) => p.key !== key));
  };

  const addPermission = (perm: Permission) => {
    onUpdate([...permissions, perm]);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold capitalize">{role} Template</h3>
          <Badge variant={source === "template" ? "info" : "secondary"}>{source || "default"}</Badge>
          <Badge variant="secondary" className="font-mono-data text-[10px]">
            {permissions.length} permissions
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddPermissionSheet onAdd={addPermission} />
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button size="sm" variant="default" className="gap-1.5" onClick={onSave}>
              Save
            </Button>
          </motion.div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Button size="sm" variant="default" className="gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Rollout
                </Button>
              </motion.div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permission Rollout — {role}</AlertDialogTitle>
                <AlertDialogDescription>
                  This will apply the current {role} permission template to all users with this role.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRollout}>Confirm Rollout</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="divide-y divide-border">
        <AnimatePresence mode="popLayout">
          {permissions.map((perm) => (
            <motion.div
              key={perm.key}
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
                <Badge variant="secondary" className="font-mono-data text-[10px]">
                  {perm.methods.join(", ")}
                </Badge>
                <motion.div whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.1 }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removePermission(perm.key)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function RoleTemplatesPage() {
  const queryClient = useQueryClient();
  const cleanerQuery = useQuery({ queryKey: ["role-template", "cleaner"], queryFn: () => fetchRoleTemplate("cleaner") });
  const customerQuery = useQuery({ queryKey: ["role-template", "customer"], queryFn: () => fetchRoleTemplate("customer") });

  const [cleanerPerms, setCleanerPerms] = useState<Permission[]>([]);
  const [customerPerms, setCustomerPerms] = useState<Permission[]>([]);

  useEffect(() => {
    if (cleanerQuery.data?.permissionList?.permissions) {
      setCleanerPerms(cleanerQuery.data.permissionList.permissions);
    }
  }, [cleanerQuery.data]);

  useEffect(() => {
    if (customerQuery.data?.permissionList?.permissions) {
      setCustomerPerms(customerQuery.data.permissionList.permissions);
    }
  }, [customerQuery.data]);

  const saveMutation = useMutation({
    mutationFn: ({ role, permissions }: { role: "cleaner" | "customer"; permissions: Permission[] }) =>
      updateRoleTemplate(role, { permissions }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["role-template"] }),
  });

  const rolloutMutation = useMutation({
    mutationFn: (role: "cleaner" | "customer") => rolloutRoleTemplate(role),
  });

  const loading = cleanerQuery.isLoading || customerQuery.isLoading;
  const hasError = cleanerQuery.isError || customerQuery.isError;

  const cleanerSource = useMemo(() => cleanerQuery.data?.source || "template", [cleanerQuery.data]);
  const customerSource = useMemo(() => customerQuery.data?.source || "default", [customerQuery.data]);

  return (
    <div className="space-y-6 max-w-[1000px]">
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
            onUpdate={setCleanerPerms}
            onSave={() => saveMutation.mutate({ role: "cleaner", permissions: cleanerPerms })}
            onRollout={() => rolloutMutation.mutate("cleaner")}
          />
          <TemplateSection
            role="customer"
            source={customerSource}
            permissions={customerPerms}
            onUpdate={setCustomerPerms}
            onSave={() => saveMutation.mutate({ role: "customer", permissions: customerPerms })}
            onRollout={() => rolloutMutation.mutate("customer")}
          />
        </>
      )}
    </div>
  );
}
