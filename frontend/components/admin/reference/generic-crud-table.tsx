"use client";

import { useState } from "react";
import { DataTable } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "textarea" | "checkbox";
  required?: boolean;
}

interface GenericCrudTableProps {
  entityName: string;
  queryKey: string[];
  fetchFn: () => Promise<any>;
  createFn: (data: any) => Promise<any>;
  updateFn: (id: number, data: any) => Promise<any>;
  deleteFn: (id: number) => Promise<any>;
  columns: ColumnDef<any>[];
  fields: FieldConfig[];
  title?: string;
  description?: string;
}

export function GenericCrudTable({
  entityName,
  queryKey,
  fetchFn,
  createFn,
  updateFn,
  deleteFn,
  columns,
  fields,
  title,
  description,
}: GenericCrudTableProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: fetchFn,
  });

  const createMutation = useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      toast.success(`${entityName} created successfully`);
      queryClient.invalidateQueries({ queryKey });
      handleClose();
    },
    onError: () => toast.error(`Failed to create ${entityName}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateFn(id, data),
    onSuccess: () => {
      toast.success(`${entityName} updated successfully`);
      queryClient.invalidateQueries({ queryKey });
      handleClose();
    },
    onError: () => toast.error(`Failed to update ${entityName}`),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      toast.success(`${entityName} deleted successfully`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error(`Failed to delete ${entityName}`),
  });

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({});
    setIsOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm(`Are you sure you want to delete this ${entityName}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingItem(null);
    setFormData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  // Add default Actions column if not present
  const tableColumns = [
    ...columns,
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: any }) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {title && <h2 className="text-xl font-bold">{title}</h2>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add {entityName}
          </Button>
        </div>
      </div>

      <DataTable columns={tableColumns} data={data || []} />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Edit ${entityName}` : `New ${entityName}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.name}
                    value={formData[field.name] || ""}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    required={field.required}
                  />
                ) : field.type === "checkbox" ? (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={field.name}
                      checked={!!formData[field.name]}
                      onCheckedChange={(checked) =>
                        handleChange(field.name, checked)
                      }
                    />
                    <label htmlFor={field.name} className="text-sm">
                      Enabled
                    </label>
                  </div>
                ) : (
                  <Input
                    id={field.name}
                    type="text"
                    value={formData[field.name] || ""}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    required={field.required}
                  />
                )}
              </div>
            ))}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
