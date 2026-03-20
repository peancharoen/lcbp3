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
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Field {
  name: string;
  label: string;
  type: "text" | "number" | "checkbox" | "select" | "textarea";
  required?: boolean;
  options?: { label: string; value: string | number }[];
}

interface ApiError extends Error {
  response?: { data?: { message?: string } };
}

interface GenericCrudTableProps<T> {
  title: string;
  description?: string;
  entityName: string;
  queryKey: string[];
  fetchFn: () => Promise<T[] | { data: T[] }>;
  createFn: (data: Record<string, unknown>) => Promise<unknown>;
  updateFn: (id: number, data: Record<string, unknown>) => Promise<unknown>;
  deleteFn: (id: number) => Promise<unknown>;
  columns: ColumnDef<T>[];
  fields: Field[];
  filters?: React.ReactNode;
}

export function GenericCrudTable<T extends { id?: number; uuid?: string }>({
  title,
  description,
  entityName,
  queryKey,
  fetchFn,
  createFn,
  updateFn,
  deleteFn,
  columns,
  fields,
  filters,
}: GenericCrudTableProps<T>) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingId] = useState<number | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: fetchFn,
  });

  // ADR-019: Support both direct array or wrapped data object
  const data: T[] = Array.isArray(rawData) ? rawData : (rawData as { data?: T[] } | undefined)?.data || [];

  const createMutation = useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${entityName} created successfully`);
      setIsDialogOpen(false);
      reset();
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || `Failed to create ${entityName}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => updateFn(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${entityName} updated successfully`);
      setIsDialogOpen(false);
      setEditingId(null);
      reset();
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || `Failed to update ${entityName}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${entityName} deleted successfully`);
      setItemToDelete(null);
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || `Failed to delete ${entityName}`);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm();

  const table = useReactTable({
    data,
    columns: [
      ...columns,
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
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
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setItemToDelete(row.original.id as number)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  const handleAdd = () => {
    setEditingId(null);
    reset();
    fields.forEach((f) => {
      if (f.type === "checkbox") setValue(f.name, true);
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (item: T) => {
    setEditingId(item.id as number);
    reset(item as Record<string, unknown>);
    // Ensure select values are strings for Shadcn Select
    fields.forEach(f => {
        const record = item as Record<string, unknown>;
        if (f.type === 'select' && record[f.name]) {
            setValue(f.name, String(record[f.name]));
        }
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (formData: Record<string, unknown>) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add {entityName}
        </Button>
      </div>

      {filters && <div className="py-2">{filters}</div>}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  No data found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Edit ${entityName}` : `Add New ${entityName}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label} {field.required && "*"}
                </Label>
                {field.type === "checkbox" ? (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={field.name}
                      checked={watch(field.name)}
                      onCheckedChange={(checked) => setValue(field.name, checked)}
                    />
                    <label
                      htmlFor={field.name}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Active
                    </label>
                  </div>
                ) : field.type === "select" ? (
                  <Select
                    value={String(watch(field.name) || "")}
                    onValueChange={(val) => setValue(field.name, val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${field.label}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea
                    id={field.name}
                    {...register(field.name, { required: field.required })}
                  />
                ) : (
                  <Input
                    id={field.name}
                    type={field.type}
                    {...register(field.name, {
                      required: field.required,
                      valueAsNumber: field.type === "number",
                    })}
                  />
                )}
                {errors[field.name] && (
                  <p className="text-xs text-red-500 font-medium">
                    {field.label} is required
                  </p>
                )}
              </div>
            ))}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingItem ? "Save Changes" : `Add ${entityName}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={itemToDelete !== null}
        onOpenChange={(open) => !open && setItemToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this{" "}
              {entityName.toLowerCase()} and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
