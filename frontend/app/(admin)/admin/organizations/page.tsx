"use client";

import { useState, useEffect } from "react";
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
import { Organization } from "@/types/admin";
import { adminApi } from "@/lib/api/admin";
import { ColumnDef } from "@tanstack/react-table";
import { Loader2, Plus } from "lucide-react";

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    org_code: "",
    org_name: "",
    org_name_th: "",
    description: "",
  });

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getOrganizations();
      setOrganizations(data);
    } catch (error) {
      console.error("Failed to fetch organizations", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const columns: ColumnDef<Organization>[] = [
    { accessorKey: "org_code", header: "Code" },
    { accessorKey: "org_name", header: "Name (EN)" },
    { accessorKey: "org_name_th", header: "Name (TH)" },
    { accessorKey: "description", header: "Description" },
  ];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await adminApi.createOrganization(formData);
      setDialogOpen(false);
      setFormData({
        org_code: "",
        org_name: "",
        org_name_th: "",
        description: "",
      });
      fetchOrgs();
    } catch (error) {
      console.error(error);
      alert("Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground mt-1">Manage project organizations</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Organization
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable columns={columns} data={organizations} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="org_code">Organization Code *</Label>
              <Input
                id="org_code"
                value={formData.org_code}
                onChange={(e) =>
                  setFormData({ ...formData, org_code: e.target.value })
                }
                placeholder="e.g., PAT"
              />
            </div>
            <div>
              <Label htmlFor="org_name">Name (English) *</Label>
              <Input
                id="org_name"
                value={formData.org_name}
                onChange={(e) =>
                  setFormData({ ...formData, org_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="org_name_th">Name (Thai)</Label>
              <Input
                id="org_name_th"
                value={formData.org_name_th}
                onChange={(e) =>
                  setFormData({ ...formData, org_name_th: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
