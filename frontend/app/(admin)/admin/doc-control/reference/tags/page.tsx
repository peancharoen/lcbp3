"use client";

import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { masterDataService } from "@/lib/services/master-data.service";
import { projectService } from "@/lib/services/project.service";
import { CreateTagDto } from "@/types/dto/master/tag.dto";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

export default function TagsPage() {
  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectService.getAll(),
  });

  const projectOptions = [
    { label: "Global (All Projects)", value: "__none__" },
    ...(projectsData || []).map((p: Record<string, unknown>) => ({
      label: (p.projectName || p.projectCode || p.project_name || p.project_code || `Project ${p.id}`) as string,
      value: String(p.id), // p.id = UUID string via serialization
    })),
  ];

  const columns: ColumnDef<Record<string, unknown>>[] = [
    {
      accessorKey: "project_id",
      header: "Project",
      cell: ({ row }) => {
        const item = row.original as Record<string, unknown>;
        const project = item.project as Record<string, unknown> | null;
        if (!project) return <span className="text-muted-foreground italic">Global</span>;
        return (project.projectName || project.projectCode || `Project ${project.id}`) as React.ReactNode;
      },
    },
    {
      accessorKey: "tag_name",
      header: "Tag Name",
      cell: ({ row }) => {
        const color = String(row.original.color_code || 'default');
        const isHex = color.startsWith('#');
        return (
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border border-border"
              style={{ backgroundColor: isHex ? color : (color === 'default' ? '#e2e8f0' : color) }}
            />
            {String(row.original.tag_name)}
          </div>
        );
      }
    },
    {
      accessorKey: "description",
      header: "Description",
    },
  ];

  const formatPayload = (data: Record<string, unknown>) => {
    const payload = { ...data };
    // ADR-019: project_id is now a UUID string or '__none__' for global
    if (!payload.project_id || payload.project_id === "__none__") {
        payload.project_id = null;
    }
    return payload;
  };

  return (
    <GenericCrudTable
      title="Tags"
      description="Manage system tags, multi-tenant capable."
      entityName="Tag"
      queryKey={["tags"]}
      fetchFn={async () => {
        const items = await masterDataService.getTags();
        // ADR-019: Map project_id INT → project UUID for edit mode select matching
        return (items as Record<string, unknown>[]).map((item) => {
          const rec = item as { project?: { id?: number; uuid?: string }; project_id?: number };
          return {
            ...item,
            project_id: rec.project?.id || rec.project?.uuid || (rec.project_id ? String(rec.project_id) : null),
          };
        });
      }}
      createFn={(data: Record<string, unknown>) => masterDataService.createTag(formatPayload(data) as unknown as CreateTagDto)}
      updateFn={(id, data) => masterDataService.updateTag(id, formatPayload(data))}
      deleteFn={(id) => masterDataService.deleteTag(id)}
      columns={columns}
      fields={[
        {
          name: "project_id",
          label: "Project Scope",
          type: "select",
          options: projectOptions,
          required: false,
        },
        {
          name: "tag_name",
          label: "Tag Name",
          type: "text",
          required: true,
        },
        {
          name: "color_code",
          label: "Color Code (Hex or Name)",
          type: "text",
          required: false,
        },
        {
          name: "description",
          label: "Description",
          type: "textarea",
          required: false,
        },
      ]}
    />
  );
}
