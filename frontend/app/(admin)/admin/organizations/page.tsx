"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/data-table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useOrganizations,
  useDeleteOrganization,
} from "@/hooks/use-master-data";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, Plus, Search, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Organization } from "@/types/organization";
import { OrganizationDialog } from "@/components/admin/organization-dialog";

// Organization role types for display
const ORGANIZATION_ROLES = [
  { value: "1", label: "Owner" },
  { value: "2", label: "Designer" },
  { value: "3", label: "Consultant" },
  { value: "4", label: "Contractor" },
  { value: "5", label: "Third Party" },
] as const;

export default function OrganizationsPage() {
  const [search, setSearch] = useState("");
  const { data: organizations, isLoading } = useOrganizations({
    search: search || undefined,
  });

  const deleteOrg = useDeleteOrganization();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);

  const columns: ColumnDef<Organization>[] = [
    {
      accessorKey: "organizationCode",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.organizationCode}</span>
      ),
    },
    { accessorKey: "organizationName", header: "Name" },
    {
      accessorKey: "roleId",
      header: "Role",
      cell: ({ row }) => {
        const roleId = row.getValue("roleId") as number;
        const role = ORGANIZATION_ROLES.find(
          (r) => r.value === roleId?.toString()
        );
        return role ? role.label : "-";
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "destructive"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => {
        if (!row.original.createdAt) return "-";
        return new Date(row.original.createdAt).toLocaleDateString("en-GB");
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const org = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelectedOrganization(org);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  if (confirm(`Delete organization ${org.organizationCode}?`)) {
                    deleteOrg.mutate(org.id);
                  }
                }}
              >
                <Trash className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground mt-1">
            Manage project organizations system-wide
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedOrganization(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Organization
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-muted/30 p-4 rounded-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-background"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Loading organizations...</div>
      ) : (
        <DataTable columns={columns} data={organizations || []} />
      )}

      <OrganizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organization={selectedOrganization}
      />
    </div>
  );
}
