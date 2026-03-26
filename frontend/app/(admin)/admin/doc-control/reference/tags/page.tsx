'use client';

import { GenericCrudTable } from '@/components/admin/reference/generic-crud-table';
import { masterDataService } from '@/lib/services/master-data.service';
import { projectService } from '@/lib/services/project.service';
import { CreateTagDto } from '@/types/dto/master/tag.dto';
import { ColumnDef } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { Tag } from '@/types/master-data';

export default function TagsPage() {
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll(),
  });

  const projectOptions = [
    { label: 'Global (All Projects)', value: '__none__' },
    ...(projectsData || []).map((p: { id?: number; publicId?: string; projectName?: string; projectCode?: string }) => ({
      label: (p.projectName || p.projectCode || `Project ${p.publicId || p.id}`) as string,
      value: String(p.publicId ?? p.id ?? ''), // ADR-019: publicId is the UUID exposed in API
    })),
  ];

  const columns: ColumnDef<Tag>[] = [
    {
      accessorKey: 'project_id',
      header: 'Project',
      cell: ({ row }) => {
        const item = row.original as Tag & { project?: { id?: number | string; projectName?: string; projectCode?: string } };
        const project = item.project;
        if (!project) return <span className="text-muted-foreground italic">Global</span>;
        return (project.projectName || project.projectCode || `Project ${project.id}`) as React.ReactNode;
      },
    },
    {
      accessorKey: 'tag_name',
      header: 'Tag Name',
      cell: ({ row }) => {
        const color = String(row.original.colorCode || 'default');
        const isHex = color.startsWith('#');
        return (
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border border-border"
              style={{ backgroundColor: isHex ? color : color === 'default' ? '#e2e8f0' : color }}
            />
            {String(row.original.tagName)}
          </div>
        );
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
    },
  ];

  const formatPayload = (data: Record<string, unknown>) => {
    const payload = { ...data };
    // ADR-019: project_id is now a UUID string or '__none__' for global
    if (!payload.project_id || payload.project_id === '__none__') {
      payload.project_id = null;
    }
    return payload;
  };

  return (
    <GenericCrudTable
      title="Tags"
      description="Manage system tags, multi-tenant capable."
      entityName="Tag"
      queryKey={['tags']}
      fetchFn={async () => {
        const items = await masterDataService.getTags();
        // ADR-019: Map project_id INT → project UUID for edit mode select matching
        return items.map((item) => {
          const rec = item as Tag & { project?: { id?: number | string; uuid?: string }; project_id?: number | string };
          return {
            ...item,
            project_id: rec.project?.id || rec.project?.uuid || (rec.project_id ? String(rec.project_id) : null),
          } as Tag;
        });
      }}
      createFn={(data: Record<string, unknown>) =>
        masterDataService.createTag(formatPayload(data) as unknown as CreateTagDto)
      }
      updateFn={(id, data) => masterDataService.updateTag(id, formatPayload(data))}
      deleteFn={(id) => masterDataService.deleteTag(id)}
      columns={columns}
      fields={[
        {
          name: 'project_id',
          label: 'Project Scope',
          type: 'select',
          options: projectOptions,
          required: false,
        },
        {
          name: 'tagName',
          label: 'Tag Name',
          type: 'text',
          required: true,
        },
        {
          name: 'colorCode',
          label: 'Color Code (Hex or Name)',
          type: 'text',
          required: false,
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          required: false,
        },
      ]}
    />
  );
}
