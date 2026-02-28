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

interface Volume {
  id: number;
  volumeCode: string;
  volumeName: string;
  description?: string;
  sortOrder: number;
}

export default function ContractVolumesPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();

  const columns: ColumnDef<Volume>[] = [
    {
      accessorKey: "volumeCode",
      header: "Code",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.getValue("volumeCode")}
        </Badge>
      ),
    },
    {
      accessorKey: "volumeName",
      header: "Volume Name",
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
          <h1 className="text-2xl font-bold">Contract Drawing Volumes</h1>
          <p className="text-muted-foreground mt-1">
            Manage drawing volumes (เล่ม) for contract drawings
          </p>
        </div>
        {projectFilter}
        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
          Please select a project to manage volumes.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Volume"
        title="Contract Drawing Volumes"
        description="Manage drawing volumes (เล่ม) for contract drawings"
        queryKey={["contract-drawing-volumes", String(selectedProjectId)]}
        fetchFn={() => drawingMasterDataService.getContractVolumes(selectedProjectId)}
        createFn={(data: Record<string, unknown>) => drawingMasterDataService.createContractVolume({ ...(data as unknown as Parameters<typeof drawingMasterDataService.createContractVolume>[0]), projectId: selectedProjectId })}
        updateFn={(id, data) => drawingMasterDataService.updateContractVolume(id, data)}
        deleteFn={(id) => drawingMasterDataService.deleteContractVolume(id)}
        columns={columns}
        fields={[
          { name: "volumeCode", label: "Volume Code", type: "text", required: true },
          { name: "volumeName", label: "Volume Name", type: "text", required: true },
          { name: "description", label: "Description", type: "textarea" },
          { name: "sortOrder", label: "Sort Order", type: "text", required: true },
        ]}
        filters={projectFilter}
      />
    </div>
  );
}
