"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrganizations, useCreateOrganization, useUpdateOrganization, useDeleteOrganization } from "@/hooks/use-master-data";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Organization {
    organization_id: number;
    org_code: string;
    org_name: string;
    org_name_th: string;
    description?: string;
}

export default function OrganizationsPage() {
  const { data: organizations, isLoading } = useOrganizations();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({
    org_code: "",
    org_name: "",
    org_name_th: "",
    description: "",
  });

  const columns: ColumnDef<Organization>[] = [
    { accessorKey: "org_code", header: "Code" },
    { accessorKey: "org_name", header: "Name (EN)" },
    { accessorKey: "org_name_th", header: "Name (TH)" },
    { accessorKey: "description", header: "Description" },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <Pencil className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                            if (confirm("Delete this organization?")) {
                                deleteOrg.mutate(row.original.organization_id);
                            }
                        }}
                    >
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
  ];

  const handleEdit = (org: Organization) => {
      setEditingOrg(org);
      setFormData({
          org_code: org.org_code,
          org_name: org.org_name,
          org_name_th: org.org_name_th,
          description: org.description || ""
      });
      setDialogOpen(true);
  };

  const handleAdd = () => {
      setEditingOrg(null);
      setFormData({ org_code: "", org_name: "", org_name_th: "", description: "" });
      setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (editingOrg) {
          updateOrg.mutate({ id: editingOrg.organization_id, data: formData }, {
              onSuccess: () => setDialogOpen(false)
          });
      } else {
          createOrg.mutate(formData, {
              onSuccess: () => setDialogOpen(false)
          });
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground mt-1">Manage project organizations system-wide</p>
        </div>
        <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add Organization
        </Button>
      </div>

      <DataTable columns={columns} data={organizations || []} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrg ? "Edit Organization" : "New Organization"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input
                value={formData.org_code}
                onChange={(e) => setFormData({ ...formData, org_code: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Name (EN)</Label>
              <Input
                value={formData.org_name}
                onChange={(e) => setFormData({ ...formData, org_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Name (TH)</Label>
              <Input
                value={formData.org_name_th}
                onChange={(e) => setFormData({ ...formData, org_name_th: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createOrg.isPending || updateOrg.isPending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
