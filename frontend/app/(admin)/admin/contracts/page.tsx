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
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from "@/lib/services/project.service";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, Plus, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import apiClient from "@/lib/api/client";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
// import { useProjects } from "@/lib/services/project.service"; // Removed invalid import
// I need to import useProjects hook from the page where it was defined or create it.
// Checking projects/page.tsx, it uses useProjects from somewhere?
// Ah, usually I define hooks in a separate file or inline if simple.
// Let's rely on standard react-query params here.

const contractSchema = z.object({
  contractCode: z.string().min(1, "Contract Code is required"),
  contractName: z.string().min(1, "Contract Name is required"),
  projectId: z.string().min(1, "Project is required"),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type ContractFormData = z.infer<typeof contractSchema>;

// Inline hooks for simplicity, or could move to hooks/use-master-data
const useContracts = (params?: any) => {
    return useQuery({
        queryKey: ['contracts', params],
        queryFn: () => projectService.getAllContracts(params),
    });
};

const useProjectsList = () => {
    return useQuery({
        queryKey: ['projects-list'],
        queryFn: () => projectService.getAll(),
    });
};

export default function ContractsPage() {
  const [search, setSearch] = useState("");
  const { data: contracts, isLoading } = useContracts({ search: search || undefined });
  const { data: projects } = useProjectsList();

  const queryClient = useQueryClient();

  const createContract = useMutation({
      mutationFn: (data: any) => apiClient.post("/contracts", data).then(res => res.data),
      onSuccess: () => {
          toast.success("Contract created successfully");
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
          setDialogOpen(false);
      },
      onError: (err: any) => toast.error(err.message || "Failed to create contract")
  });

  const updateContract = useMutation({
      mutationFn: ({ id, data }: { id: number, data: any }) => apiClient.patch(`/contracts/${id}`, data).then(res => res.data),
      onSuccess: () => {
          toast.success("Contract updated successfully");
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
          setDialogOpen(false);
      },
      onError: (err: any) => toast.error(err.message || "Failed to update contract")
  });

  const deleteContract = useMutation({
      mutationFn: (id: number) => apiClient.delete(`/contracts/${id}`).then(res => res.data),
      onSuccess: () => {
          toast.success("Contract deleted successfully");
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
      },
      onError: (err: any) => toast.error(err.message || "Failed to delete contract")
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const {
      register,
      handleSubmit,
      reset,
      setValue,
      watch,
      formState: { errors },
  } = useForm<ContractFormData>({
      resolver: zodResolver(contractSchema),
      defaultValues: {
          contractCode: "",
          contractName: "",
          projectId: "",
          description: "",
      },
  });

  const columns: ColumnDef<any>[] = [
    {
       accessorKey: "contractCode",
       header: "Code",
       cell: ({ row }) => <span className="font-medium">{row.original.contractCode}</span>
    },
    { accessorKey: "contractName", header: "Name" },
    {
        accessorKey: "project.projectCode",
        header: "Project",
        cell: ({ row }) => row.original.project?.projectCode || "-"
    },
    { accessorKey: "startDate", header: "Start Date" },
    { accessorKey: "endDate", header: "End Date" },
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
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                            if (confirm(`Delete contract ${row.original.contractCode}?`)) {
                                deleteContract.mutate(row.original.id);
                            }
                        }}
                    >
                        <Trash className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
  ];

  const handleEdit = (contract: any) => {
      setEditingId(contract.id);
      reset({
          contractCode: contract.contractCode,
          contractName: contract.contractName,
          projectId: contract.projectId?.toString() || "",
          description: contract.description || "",
          startDate: contract.startDate ? new Date(contract.startDate).toISOString().split('T')[0] : "",
          endDate: contract.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : "",
      });
      setDialogOpen(true);
  };

  const handleCreate = () => {
      setEditingId(null);
      reset({
          contractCode: "",
          contractName: "",
          projectId: "",
          description: "",
          startDate: "",
          endDate: "",
      });
      setDialogOpen(true);
  };

  const onSubmit = (data: ContractFormData) => {
      const submitData = {
          ...data,
          projectId: parseInt(data.projectId),
      };

      if (editingId) {
          updateContract.mutate({ id: editingId, data: submitData });
      } else {
          createContract.mutate(submitData);
      }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contracts</h1>
          <p className="text-muted-foreground mt-1">Manage construction contracts</p>
        </div>
        <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Contract
        </Button>
      </div>

       <div className="flex items-center space-x-2 bg-muted/30 p-4 rounded-lg">
          <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                  placeholder="Search contracts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 bg-background"
              />
          </div>
       </div>

      {isLoading ? (
          <div className="text-center py-10">Loading contracts...</div>
      ) : (
          <DataTable columns={columns} data={contracts || []} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Contract" : "New Contract"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <div className="space-y-2">
                <Label>Project *</Label>
                <Select
                    value={watch("projectId")}
                    onValueChange={(value) => setValue("projectId", value)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select Project" />
                    </SelectTrigger>
                    <SelectContent>
                        {projects?.map((p: any) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                                {p.projectCode} - {p.projectName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.projectId && (
                    <p className="text-sm text-red-500">{errors.projectId.message}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Contract Code *</Label>
                    <Input
                        placeholder="e.g. C-001"
                        {...register("contractCode")}
                    />
                    {errors.contractCode && (
                        <p className="text-sm text-red-500">{errors.contractCode.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Contract Name *</Label>
                    <Input
                        placeholder="e.g. Main Construction"
                        {...register("contractName")}
                    />
                    {errors.contractName && (
                        <p className="text-sm text-red-500">{errors.contractName.message}</p>
                    )}
                </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                {...register("description")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" {...register("startDate")} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" {...register("endDate")} />
                </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createContract.isPending || updateContract.isPending}>
                {editingId ? "Save Changes" : "Create Contract"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
