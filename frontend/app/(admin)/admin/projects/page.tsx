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
} from "@/components/ui/dialog";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "@/hooks/use-projects";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, Plus, Folder } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: number;
  projectCode: string;
  projectName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    projectCode: "",
    projectName: "",
    isActive: true,
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
    setEditingProject(project);
    setFormData({
      projectCode: project.projectCode,
      projectName: project.projectName,
      isActive: project.isActive,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingProject(null);
    setFormData({ projectCode: "", projectName: "", isActive: true });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      updateProject.mutate(
        { id: editingProject.id, data: formData },
        {
          onSuccess: () => setDialogOpen(false),
        }
      );
    } else {
      createProject.mutate(formData, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage construction projects and configurations
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Project
        </Button>
      </div>

      <DataTable columns={columns} data={projects || []} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Edit Project" : "New Project"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Project Code</Label>
              <Input
                placeholder="e.g. LCBP3"
                value={formData.projectCode}
                onChange={(e) =>
                  setFormData({ ...formData, projectCode: e.target.value })
                }
                required
                disabled={!!editingProject} // Code is usually immutable or derived
              />
            </div>
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input
                placeholder="Full project name"
                value={formData.projectName}
                onChange={(e) =>
                  setFormData({ ...formData, projectName: e.target.value })
                }
                required
              />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="active"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
              <Label htmlFor="active">Active Status</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
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
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
