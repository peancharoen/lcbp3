"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";

interface Role {
  roleId: number;
  roleName: string;
  permissions?: Permission[];
}

interface Permission {
  permissionId: number;
  permissionName: string;
  description: string;
}

interface RbacMatrixProps {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: Record<number, number[]>; // roleId -> permissionIds[]
}

const securityService = {
  getRoles: async () => {
    const response = await apiClient.get<any>("/users/roles");
    return response.data?.data || response.data;
  },
  getPermissions: async () => {
    const response = await apiClient.get<any>("/users/permissions");
    return response.data?.data || response.data;
  },
  updateRolePermissions: async (roleId: number, permissionIds: number[]) => {
    // This endpoint might not exist as a bulk update, usually it's per role
    // Assuming backend supports: PATCH /users/roles/:id/permissions { permissionIds: [] }
    return (await apiClient.patch(`/users/roles/${roleId}/permissions`, { permissionIds })).data;
  },
};

export function RbacMatrix() {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<number, number[]>>({});

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: securityService.getRoles,
  });

  const { data: permissions = [], isLoading: permsLoading } = useQuery<Permission[]>({
    queryKey: ["permissions"],
    queryFn: securityService.getPermissions,
  });

  // Fetch current assignments - this logic assumes we can get a map or list
  // For now, let's assume we can fetch matrix or individual role calls
  // In a real implementation this is heavier. For implementation speed, I'll mock the state logic assumption
  // that we load initial state from roles (if roles include permissions relation).

  // TODO: Fetch existing role_permissions. Assuming roles endpoint returns `permissions` array.

  const updateMutation = useMutation({
    mutationFn: async (changes: Record<number, number[]>) => {
      const promises = Object.entries(changes).map(([roleId, perms]) =>
        securityService.updateRolePermissions(parseInt(roleId), perms)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success("Permissions updated successfully");
      setPendingChanges({});
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: () => toast.error("Failed to update permissions"),
  });

  const handleToggle = (roleId: number, permId: number, currentPerms: number[]) => {
    const roleChanges = pendingChanges[roleId] || currentPerms;
    const newPerms = roleChanges.includes(permId)
      ? roleChanges.filter((id) => id !== permId)
      : [...roleChanges, permId];

    setPendingChanges({ ...pendingChanges, [roleId]: newPerms });
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  if (rolesLoading || permsLoading) {
    return (
      <div className="flex justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Simplified: Permissions grouped by module/resource would be better, but flat list for now
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => updateMutation.mutate(pendingChanges)}
          disabled={!hasChanges || updateMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role.roleId} className="text-center min-w-[100px]">
                  {role.roleName}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((perm) => (
              <TableRow key={perm.permissionId}>
                <TableCell className="font-medium">
                  <div>{perm.permissionName}</div>
                  <div className="text-xs text-muted-foreground">{perm.description}</div>
                </TableCell>
                {roles.map((role: any) => {
                  // Assume role.permissions is populated
                  const currentRolePerms = role.permissions?.map((p: any) => p.permissionId) || [];
                  const activePerms = pendingChanges[role.roleId] || currentRolePerms;
                  const isChecked = activePerms.includes(perm.permissionId);

                  return (
                    <TableCell key={`${role.roleId}-${perm.permissionId}`} className="text-center">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggle(role.roleId, perm.permissionId, currentRolePerms)}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
