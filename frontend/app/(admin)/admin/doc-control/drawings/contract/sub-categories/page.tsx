"use client";

import { useState } from "react";
import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/use-master-data";
import { drawingMasterDataService } from "@/lib/services/drawing-master-data.service";
import { Badge } from "@/components/ui/badge";

interface SubCategory {
  id: number;
  subCatCode: string;
  subCatName: string;
  description?: string;
  sortOrder: number;
}

export default function ContractSubCategoriesPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();

  const columns: ColumnDef<SubCategory>[] = [
    {
      accessorKey: "subCatCode",
      header: "Code",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.getValue("subCatCode")}
        </Badge>
      ),
    },
    {
      accessorKey: "subCatName",
      header: "Sub-category Name",
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.getValue("description") || "-"}
        </span>
      ),
    },
    {
      accessorKey: "sortOrder",
      header: "Order",
      cell: ({ row }) => (
        <span className="font-mono">{row.getValue("sortOrder")}</span>
      ),
    },
  ];

  const projectFilter = (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium">Project:</span>
      <Select
        value={selectedProjectId?.toString() ?? ""}
        onValueChange={(v) => setSelectedProjectId(v ? parseInt(v) : undefined)}
      >
        <SelectTrigger className="w-[300px]">
          {isLoadingProjects ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SelectValue placeholder="Select Project" />
          )}
        </SelectTrigger>
        <SelectContent>
          {projects.map((project: { id: number; projectName: string; projectCode: string }) => (
            <SelectItem key={project.id} value={String(project.id)}>
              {project.projectCode} - {project.projectName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (!selectedProjectId) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contract Drawing Sub-categories</h1>
          <p className="text-muted-foreground mt-1">
            Manage sub-categories (หมวดหมู่ย่อย) for contract drawings
          </p>
        </div>
        {projectFilter}
        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
          Please select a project to manage sub-categories.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Sub-category"
        title="Contract Drawing Sub-categories"
        description="Manage sub-categories (หมวดหมู่ย่อย) for contract drawings"
        queryKey={["contract-drawing-sub-categories", String(selectedProjectId)]}
        fetchFn={() => drawingMasterDataService.getContractSubCategories(selectedProjectId)}
        createFn={(data) => drawingMasterDataService.createContractSubCategory({ ...data, projectId: selectedProjectId })}
        updateFn={(id, data) => drawingMasterDataService.updateContractSubCategory(id, data)}
        deleteFn={(id) => drawingMasterDataService.deleteContractSubCategory(id)}
        columns={columns}
        fields={[
          { name: "subCatCode", label: "Sub-category Code", type: "text", required: true },
          { name: "subCatName", label: "Sub-category Name", type: "text", required: true },
          { name: "description", label: "Description", type: "textarea" },
          { name: "sortOrder", label: "Sort Order", type: "text", required: true },
        ]}
        filters={projectFilter}
      />
    </div>
  );
}
