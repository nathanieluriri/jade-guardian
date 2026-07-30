"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPermissionGroup, fetchPermissionGroups } from "@/lib/api/admin-api";
import { AdminLoadingState } from "@/components/AdminLoadingState";
import { useAdminProfile } from "@/hooks/use-admin-auth";
import { canAccessAdminAction } from "@/lib/admin-access";

export default function PermissionGroupsPage() {
  const queryClient = useQueryClient();
  const profileQuery = useAdminProfile();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionsCsv, setPermissionsCsv] = useState("");
  const canCreateGroup = canAccessAdminAction(
    { method: "POST", path: "/v1/admins/access/permission-groups" },
    profileQuery.data
  );
  const groupsQuery = useQuery({
    queryKey: ["admin-access", "permission-groups"],
    queryFn: fetchPermissionGroups,
  });
  const createGroupMutation = useMutation({
    mutationFn: createPermissionGroup,
    onSuccess: async () => {
      setName("");
      setDescription("");
      setPermissionsCsv("");
      toast.success("Permission group created.");
      await queryClient.invalidateQueries({ queryKey: ["admin-access", "permission-groups"] });
    },
    onError: () => toast.error("Failed to create permission group."),
  });

  const groups = groupsQuery.data || [];

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Permission Groups</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These groups can be requested when submitting an elevation request.
        </p>
      </div>

      {canCreateGroup && (
        <div className="surface-card p-4 space-y-3">
          <h2 className="text-base font-semibold">Create Custom Group</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Name</Label>
              <Input id="group-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="promo_handler" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-description">Description</Label>
              <Input
                id="group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Promo operations"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-permissions">Permissions (CSV)</Label>
            <Input
              id="group-permissions"
              value={permissionsCsv}
              onChange={(event) => setPermissionsCsv(event.target.value)}
              placeholder="GET:/admins/promo-codes, POST:/admins/promo-codes"
            />
          </div>
          <Button
            onClick={() =>
              createGroupMutation.mutate({
                name: name.trim(),
                description: description.trim() || undefined,
                permissions: permissionsCsv
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            disabled={createGroupMutation.isPending || !name.trim() || !permissionsCsv.trim()}
          >
            {createGroupMutation.isPending ? "Creating..." : "Create Group"}
          </Button>
        </div>
      )}

      {groupsQuery.isLoading && <AdminLoadingState label="Loading permission groups..." />}
      {groupsQuery.isError && <p className="font-mono-data text-destructive">Failed to load permission groups.</p>}

      {!groupsQuery.isLoading && !groupsQuery.isError && groups.length === 0 && (
        <div className="surface-card p-4">
          <p className="text-sm text-muted-foreground">No permission groups are currently available.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => {
          const permissionCount = group.permissions?.length || 0;
          const isBuiltIn = group.is_built_in || group.source === "built_in" || group.type === "built_in";
          return (
            <div key={group.id || group._id || group.name} className="surface-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{group.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{group.description || "No description provided."}</p>
                </div>
                <Badge variant={isBuiltIn ? "secondary" : "outline"}>
                  {isBuiltIn ? "Built-in" : "Custom"}
                </Badge>
              </div>
              <div className="text-xs font-mono-data text-muted-foreground">
                {permissionCount} permission{permissionCount === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
