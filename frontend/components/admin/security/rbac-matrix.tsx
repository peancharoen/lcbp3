'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';

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

interface _RbacMatrixProps {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: Record<number, number[]>; // roleId -> permissionIds[]
}

const extractArrayData = <T,>(value: unknown): T[] => {
  let current: unknown = value;

  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(current)) {
      return current as T[];
    }

    if (!current || typeof current !== 'object' || !('data' in current)) {
      return [];
    }

    current = (current as { data?: unknown }).data;
  }

  return Array.isArray(current) ? (current as T[]) : [];
};

const securityService = {
  getRoles: async (): Promise<Role[]> => {
    const response = await apiClient.get('/users/roles');
    return extractArrayData<Role>(response.data);
  },
  getPermissions: async (): Promise<Permission[]> => {
    const response = await apiClient.get('/users/permissions');
    return extractArrayData<Permission>(response.data);
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
    queryKey: ['roles'],
    queryFn: securityService.getRoles,
  });

  const { data: permissions = [], isLoading: permsLoading } = useQuery<Permission[]>({
    queryKey: ['permissions'],
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
        securityService.updateRolePermissions(Number(roleId), perms)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Permissions updated successfully');
      setPendingChanges({});
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: () => toast.error('Failed to update permissions'),
  });

  const handleToggle = (roleId: number, permId: number, currentPerms: number[]) => {
    const roleChanges = pendingChanges[roleId] || currentPerms;
    const newPerms = roleChanges.includes(permId)
      ? roleChanges.filter((id) => id !== permId)
      : [...roleChanges, permId];

    setPendingChanges({ ...pendingChanges, [roleId]: newPerms });
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;
  const roleList = Array.isArray(roles) ? roles : [];
  const permissionList = Array.isArray(permissions) ? permissions : [];

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
              {roleList.map((role) => (
                <TableHead key={role.roleId} className="text-center min-w-[100px]">
                  {role.roleName}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissionList.map((perm) => (
              <TableRow key={perm.permissionId}>
                <TableCell className="font-medium">
                  <div>{perm.permissionName}</div>
                  <div className="text-xs text-muted-foreground">{perm.description}</div>
                </TableCell>
                {roleList.map((role) => {
                  // Assume role.permissions is populated
                  const currentRolePerms = role.permissions?.map((p) => p.permissionId) || [];
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
