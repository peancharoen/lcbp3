// File: components/layout/project-switcher.tsx
'use client';

import * as React from 'react';
import { useProjects } from '@/hooks/use-projects';
import { useProjectStore } from '@/lib/stores/project-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function ProjectSwitcher() {
  const { data: projects, isLoading } = useProjects({ isActive: true });
  const { selectedProjectId, setSelectedProjectId } = useProjectStore();

  React.useEffect(() => {
    // Auto-select if there's only one project
    if (projects && projects.length === 1 && selectedProjectId !== projects[0].publicId) {
      setSelectedProjectId(projects[0].publicId);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  if (isLoading) {
    return <Skeleton className="h-9 w-[200px] lg:w-[250px]" />;
  }

  // If user has no projects, don't show the switcher
  if (!projects || projects.length === 0) {
    return null;
  }

  // If user has exactly one project, show it as text (no dropdown needed)
  if (projects.length === 1) {
    return (
      <div className="flex h-9 items-center px-3 py-2 text-sm border rounded-md bg-muted/50 w-[200px] lg:w-[250px]">
        <Building2 className="h-4 w-4 mr-2 opacity-50 flex-shrink-0" />
        <span className="truncate font-medium">{projects[0].projectName}</span>
      </div>
    );
  }

  return (
    <Select
      value={selectedProjectId || 'global'}
      onValueChange={(value) => setSelectedProjectId(value === 'global' ? null : value)}
    >
      <SelectTrigger className="w-[200px] lg:w-[250px] h-9">
        <div className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4 opacity-50 flex-shrink-0" />
          <SelectValue placeholder="Select Project..." className="truncate" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="global">All Projects (Global)</SelectItem>
        {projects.map((project) => (
          <SelectItem key={project.publicId} value={project.publicId}>
            {project.projectName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
