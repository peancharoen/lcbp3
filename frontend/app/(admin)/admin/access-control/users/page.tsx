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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { Organization } from "@/types/organization";

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

  // Stats for Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.userId, {
        onSuccess: () => {
            setDeleteDialogOpen(false);
            setUserToDelete(null);
        },
      });
    }
  };


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
        const orgId = row.original.primaryOrganizationId;
        const org = (organizations as Organization[]).find((o) => o.id === orgId);
        return org ? org.organizationCode : "-";
      },
    },
    {
      id: "roles",
      header: "Roles",
      cell: ({ row }) => {
        const roles = row.original.roles || [];
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
                className="text-red-600 focus:text-red-600"
                onClick={() => handleDeleteClick(user)}
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
                {Array.isArray(organizations) && (organizations as Organization[]).map((org) => (
                  <SelectItem key={org.id} value={org.id.toString()}>
                    {org.organizationCode} - {org.organizationName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
         </div>
      </div>

      {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
      ) : (
          <DataTable columns={columns} data={users || []} />
      )}

      <UserDialog
         open={dialogOpen}
         onOpenChange={setDialogOpen}
         user={selectedUser}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              <span className="font-semibold text-foreground"> {userToDelete?.username} </span>
              and remove them from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700"
            >
                {deleteMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
