"use client";

import { useUsers, useDeleteUser } from "@/hooks/use-users";
import { useOrganizations } from "@/hooks/use-master-data";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/data-table";
import { Plus, MoreHorizontal, Pencil, Trash, Search } from "lucide-react";
import { useState } from "react";
import { UserDialog } from "@/components/admin/user-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { User } from "@/types/user";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: users, isLoading } = useUsers({
    search: search || undefined,
    primaryOrganizationId: selectedOrgId ? parseInt(selectedOrgId) : undefined,
  });

  const { data: organizations = [] } = useOrganizations();

  const deleteMutation = useDeleteUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) => <span className="font-semibold">{row.original.username}</span>
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`,
    },
    {
      id: "organization",
      header: "Organization",
      cell: ({ row }) => {
        // Need to find org in list if not populated or if only ID exists
        // Assuming backend populates organization object or we map it from ID
        // Currently User type has organization?
        // Let's rely on finding it from the master data if missing
        const orgId = row.original.primaryOrganizationId;
        const org = organizations.find((o: any) => o.id === orgId);
        return org ? org.organizationCode : "-";
      },
    },
    {
      id: "roles",
      header: "Roles",
      cell: ({ row }) => {
        const roles = row.original.roles || [];
        // If roles is empty, it might be lazy loaded or just assignments
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge key={r.roleId} variant="outline" className="text-xs">
                {r.roleName}
              </Badge>
            ))}
          </div>
        );
      }
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setSelectedUser(user); setDialogOpen(true); }}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  if (confirm("Are you sure?")) deleteMutation.mutate(user.userId);
                }}
              >
                <Trash className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users and roles</p>
        </div>
        <Button onClick={() => { setSelectedUser(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-muted/30 p-4 rounded-lg">
         <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-background"
            />
         </div>
         <div className="w-[250px]">
            <Select
              value={selectedOrgId || "all"}
              onValueChange={(val) => setSelectedOrgId(val === "all" ? null : val)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {Array.isArray(organizations) && organizations.map((org: any) => (
                  <SelectItem key={org.id} value={org.id.toString()}>
                    {org.organizationCode} - {org.organizationName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
         </div>
      </div>

      {isLoading ? (
          <div className="text-center py-10">Loading users...</div>
      ) : (
          <DataTable columns={columns} data={users || []} />
      )}

      <UserDialog
         open={dialogOpen}
         onOpenChange={setDialogOpen}
         user={selectedUser}
      />
    </div>
  );
}
