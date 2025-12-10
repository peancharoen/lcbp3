"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "@/hooks/use-projects";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, Plus, Folder, Search as SearchIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface Project {
  id: number;
  projectCode: string;
  projectName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const projectSchema = z.object({
  projectCode: z.string().min(1, "Project Code is required"),
  projectName: z.string().min(1, "Project Name is required"),
  isActive: z.boolean().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const { data: projects, isLoading } = useProjects({ search: search || undefined });

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectCode: "",
      projectName: "",
      isActive: true,
    },
  });

  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: "projectCode",
      header: "Code",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{row.original.projectCode}</span>
        </div>
      ),
    },
    { accessorKey: "projectName", header: "Project Name" },
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
                if (confirm(`Delete project ${row.original.projectCode}?`)) {
                  deleteProject.mutate(row.original.id);
                }
              }}
            >
              <Trash className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleEdit = (project: Project) => {
    setEditingId(project.id);
    reset({
      projectCode: project.projectCode,
      projectName: project.projectName,
      isActive: project.isActive,
    });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    reset({
      projectCode: "",
      projectName: "",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: ProjectFormData) => {
    if (editingId) {
      updateProject.mutate(
        { id: editingId, data },
        {
          onSuccess: () => setDialogOpen(false),
        }
      );
    } else {
      createProject.mutate(data, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage construction projects and configurations
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Project
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-muted/30 p-4 rounded-lg">
        <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search projects by code or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-background"
            />
        </div>
      </div>

      {isLoading ? (
         <div className="text-center py-10">Loading projects...</div>
      ) : (
         <DataTable columns={columns} data={projects || []} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Project" : "New Project"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Project Code *</Label>
              <Input
                placeholder="e.g. LCBP3"
                {...register("projectCode")}
                disabled={!!editingId} // Code is immutable after creation usually
              />
              {errors.projectCode && (
                  <p className="text-sm text-red-500">{errors.projectCode.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Project Name *</Label>
              <Input
                placeholder="Full project name"
                {...register("projectName")}
              />
              {errors.projectName && (
                  <p className="text-sm text-red-500">{errors.projectName.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="active"
                checked={watch("isActive")}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
              <Label htmlFor="active">Active Status</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProject.isPending || updateProject.isPending}
              >
                {editingId ? "Save Changes" : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
