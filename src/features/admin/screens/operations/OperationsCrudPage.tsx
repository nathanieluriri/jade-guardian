"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
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
import { Switch } from "@/components/ui/switch";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { canAccessAdminAction, type PermissionRequirement } from "@/lib/admin-access";
import type { AdminResourceItem, AdminResourcePayload } from "@/lib/api/types";
import { itemId, optimisticDeleteHandlers } from "@/features/admin/screens/operations/optimistic-delete";

export type CrudFieldType = "text" | "number" | "textarea" | "boolean" | "array_csv";

export type CrudField = {
  key: string;
  label: string;
  type: CrudFieldType;
  required?: boolean;
  placeholder?: string;
};

type OperationsCrudPageProps = {
  title: string;
  description: string;
  queryKey: string;
  readRequirement: PermissionRequirement;
  createRequirement: PermissionRequirement;
  updateRequirement: PermissionRequirement;
  deleteRequirement: PermissionRequirement;
  fields: CrudField[];
  listFn: () => Promise<AdminResourceItem[]>;
  createFn: (payload: AdminResourcePayload) => Promise<unknown>;
  updateFn: (id: string, payload: AdminResourcePayload) => Promise<unknown>;
  deleteFn: (id: string) => Promise<unknown>;
};

function initialValues(fields: CrudField[]) {
  return fields.reduce<Record<string, string | boolean>>((acc, field) => {
    acc[field.key] = field.type === "boolean" ? false : "";
    return acc;
  }, {});
}

function mapItemToFormValues(item: AdminResourceItem, fields: CrudField[]) {
  return fields.reduce<Record<string, string | boolean>>((acc, field) => {
    const value = item[field.key];
    if (field.type === "boolean") {
      acc[field.key] = Boolean(value);
      return acc;
    }
    if (field.type === "array_csv") {
      acc[field.key] = Array.isArray(value) ? value.join(", ") : "";
      return acc;
    }
    if (typeof value === "number") {
      acc[field.key] = String(value);
      return acc;
    }
    acc[field.key] = typeof value === "string" ? value : "";
    return acc;
  }, {});
}

function mapFormToPayload(values: Record<string, string | boolean>, fields: CrudField[]) {
  return fields.reduce<AdminResourcePayload>((acc, field) => {
    const value = values[field.key];
    if (field.type === "boolean") {
      acc[field.key] = Boolean(value);
      return acc;
    }
    const str = String(value || "").trim();
    if (!str && !field.required) return acc;
    if (field.type === "number") {
      acc[field.key] = str === "" ? null : Number(str);
      return acc;
    }
    if (field.type === "array_csv") {
      acc[field.key] = str
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      return acc;
    }
    acc[field.key] = str;
    return acc;
  }, {});
}

function validateRequired(values: Record<string, string | boolean>, fields: CrudField[]) {
  return fields.every((field) => {
    if (!field.required) return true;
    const value = values[field.key];
    if (field.type === "boolean") return value === true || value === false;
    return String(value || "").trim().length > 0;
  });
}

export function OperationsCrudPage({
  title,
  description,
  queryKey,
  readRequirement,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  fields,
  listFn,
  createFn,
  updateFn,
  deleteFn,
}: OperationsCrudPageProps) {
  const profileQuery = useAdminProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>(() => initialValues(fields));

  const canRead = canAccessAdminAction(readRequirement, profileQuery.data);
  const canCreate = canAccessAdminAction(createRequirement, profileQuery.data);
  const canUpdate = canAccessAdminAction(updateRequirement, profileQuery.data);
  const canDelete = canAccessAdminAction(deleteRequirement, profileQuery.data);

  const listQuery = useQuery({
    queryKey: ["operations", queryKey],
    queryFn: listFn,
    enabled: canRead,
  });

  const rows = listQuery.data || [];

  const createMutation = useMutation({
    mutationFn: (payload: AdminResourcePayload) => createFn(payload),
    onSuccess: async () => {
      toast.success("Created successfully.");
      setOpen(false);
      setEditingItemId(null);
      setFormValues(initialValues(fields));
      await queryClient.invalidateQueries({ queryKey: ["operations", queryKey] });
    },
    onError: () => toast.error("Create failed."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminResourcePayload }) => updateFn(id, payload),
    onSuccess: async () => {
      toast.success("Updated successfully.");
      setOpen(false);
      setEditingItemId(null);
      setFormValues(initialValues(fields));
      await queryClient.invalidateQueries({ queryKey: ["operations", queryKey] });
    },
    onError: () => toast.error("Update failed."),
  });

  const deleteCache = optimisticDeleteHandlers(queryClient, queryKey);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn(id),
    onMutate: deleteCache.onMutate,
    onSettled: deleteCache.onSettled,
    onSuccess: () => {
      toast.success("Deleted successfully.");
    },
    onError: (error, id, context) => {
      deleteCache.onError(error, id, context);
      toast.error("Delete failed.");
    },
  });

  const isEditing = !!editingItemId;
  const canSubmit = validateRequired(formValues, fields) && !createMutation.isPending && !updateMutation.isPending;

  const startCreate = () => {
    setEditingItemId(null);
    setFormValues(initialValues(fields));
    setOpen(true);
  };

  const startEdit = (item: AdminResourceItem) => {
    setEditingItemId(itemId(item));
    setFormValues(mapItemToFormValues(item, fields));
    setOpen(true);
  };

  const submit = () => {
    const payload = mapFormToPayload(formValues, fields);
    if (isEditing && editingItemId) {
      updateMutation.mutate({ id: editingItemId, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const previewColumns = useMemo(() => fields.slice(0, 4), [fields]);

  if (!canRead) {
    return (
      <div className="surface-card p-6">
        <p className="text-sm text-muted-foreground">You do not have permission to view this module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => listQuery.refetch()}
            disabled={listQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={startCreate} disabled={!canCreate}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{isEditing ? `Edit ${title}` : `Create ${title}`}</DialogTitle>
                <DialogDescription>Fill in required fields and save changes.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                {fields.map((field) => {
                  const value = formValues[field.key];
                  if (field.type === "textarea") {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        <Label htmlFor={field.key}>
                          {field.label}
                          {field.required ? " *" : ""}
                        </Label>
                        <Textarea
                          id={field.key}
                          placeholder={field.placeholder}
                          value={String(value || "")}
                          onChange={(event) =>
                            setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                          }
                        />
                      </div>
                    );
                  }

                  if (field.type === "boolean") {
                    return (
                      <div key={field.key} className="flex items-center justify-between rounded-md border p-3">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Switch
                          id={field.key}
                          checked={Boolean(value)}
                          onCheckedChange={(checked) =>
                            setFormValues((prev) => ({ ...prev, [field.key]: checked }))
                          }
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={field.key}>
                        {field.label}
                        {field.required ? " *" : ""}
                      </Label>
                      <Input
                        id={field.key}
                        type={field.type === "number" ? "number" : "text"}
                        placeholder={field.placeholder}
                        value={String(value || "")}
                        onChange={(event) =>
                          setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  data-testid="crud-submit"
                  onClick={submit}
                  disabled={!canSubmit || (isEditing ? !canUpdate : !canCreate)}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : isEditing
                      ? "Save Changes"
                      : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Records</span>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
        <div className="divide-y divide-border">
          {listQuery.isLoading && <TableSkeleton rows={5} columns={3} />}
          {listQuery.isError && <p className="p-4 text-sm text-destructive">Failed to load records.</p>}
          {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No records found.</p>
          )}
          {!listQuery.isLoading &&
            !listQuery.isError &&
            rows.map((row) => {
              const id = itemId(row);
              return (
                <div key={id || JSON.stringify(row)} className="p-4 flex flex-col gap-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {previewColumns.map((column) => {
                      const value = row[column.key];
                      return (
                        <div key={`${id}-${column.key}`} className="min-w-0">
                          <p className="text-xs text-muted-foreground">{column.label}</p>
                          <p className="text-sm font-medium truncate">
                            {Array.isArray(value) ? value.join(", ") : String(value ?? "-")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(row)} disabled={!canUpdate || !id}>
                      Edit
                    </Button>
                    <AlertDialog
                      open={confirmDeleteId === id}
                      onOpenChange={(next) => setConfirmDeleteId(next ? id ?? null : null)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" disabled={!canDelete || !id || deleteMutation.isPending}>
                          {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete record</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(event) => {
                              event.preventDefault();
                              if (!id) return;
                              deleteMutation.mutate(id, {
                                onSettled: () => setConfirmDeleteId(null),
                              });
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
