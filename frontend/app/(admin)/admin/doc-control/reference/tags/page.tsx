'use client';

import { useState } from 'react';
import { GenericCrudTable } from '@/components/admin/reference/generic-crud-table';
import { masterDataService } from '@/lib/services/master-data.service';
import { projectService } from '@/lib/services/project.service';
import { CreateTagDto } from '@/types/dto/master/tag.dto';
import { ColumnDef } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { Tag } from '@/types/master-data';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TagsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll(),
  });

  const projectItems = (projectsData || [])
    .map((p: { publicId?: string; projectName?: string; projectCode?: string }) => ({
      label: (p.projectName || p.projectCode || p.publicId || 'Unknown Project') as string,
      value: String(p.publicId || ''),
    }))
    .filter((option: { label: string; value: string }) => option.value !== '');

  const projectScopeOptions = [{ label: 'Global (All Projects)', value: '__none__' }, ...projectItems];

  const columns: ColumnDef<Tag>[] = [
    {
      accessorKey: 'projectId',
      header: 'Project',
      cell: ({ row }) => {
        const item = row.original as Tag & {
          project?: { publicId?: string; projectName?: string; projectCode?: string };
        };
        const project = item.project;
        if (!project) return <span className="text-muted-foreground italic">Global</span>;
        return (project.projectName || project.projectCode || project.publicId || 'Unknown Project') as React.ReactNode;
      },
    },
    {
      accessorKey: 'tagName',
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
    // ADR-019: projectId is now a UUID string or '__none__' for global
    if (!payload.projectId || payload.projectId === '__none__') {
      payload.projectId = null;
    }
    return payload;
  };

  return (
    <GenericCrudTable
      title="Tags"
      description="Manage system tags, multi-tenant capable."
      entityName="Tag"
      queryKey={['tags', selectedProjectId]}
      fetchFn={async () => {
        const items = await masterDataService.getTags(
          selectedProjectId !== 'all' ? { projectId: selectedProjectId } : undefined
        );

        return items.map((item) => {
          const rec = item as Tag & {
            project?: { publicId?: string };
            projectId?: number | string | null;
          };

          return {
            ...item,
            projectId: rec.project?.publicId || (typeof rec.projectId === 'string' ? rec.projectId : null),
          } as Tag;
        });
      }}
      createFn={(data: Record<string, unknown>) =>
        masterDataService.createTag(formatPayload(data) as unknown as CreateTagDto)
      }
      updateFn={(id, data) => masterDataService.updateTag(id, formatPayload(data))}
      deleteFn={(id) => masterDataService.deleteTag(id)}
      columns={columns}
      filters={
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="tag-project-filter">Project Filter</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger id="tag-project-filter">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projectItems.map((option: { label: string; value: string }) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      fields={[
        {
          name: 'projectId',
          label: 'Project Scope',
          type: 'select',
          options: projectScopeOptions,
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
