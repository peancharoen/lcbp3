'use client';

import { useState } from 'react';
import { GenericCrudTable } from '@/components/admin/reference/generic-crud-table';
import { ColumnDef } from '@tanstack/react-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useProjects } from '@/hooks/use-master-data';
import { drawingMasterDataService } from '@/lib/services/drawing-master-data.service';
import { Badge } from '@/components/ui/badge';

interface SubCategory {
  id: number;
  subCategoryCode: string;
  subCategoryName: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

export default function ShopSubCategoriesPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();

  console.log('Projects Data:', projects);

  const columns: ColumnDef<SubCategory>[] = [
    {
      accessorKey: 'subCategoryCode',
      header: 'Code',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.getValue('subCategoryCode')}
        </Badge>
      ),
    },
    {
      accessorKey: 'subCategoryName',
      header: 'Sub-category Name',
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.getValue('description') || '-'}</span>,
    },
    {
      accessorKey: 'isActive',
      header: 'Active',
      cell: ({ row }) =>
        row.getValue('isActive') ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        ),
    },
    {
      accessorKey: 'sortOrder',
      header: 'Order',
      cell: ({ row }) => <span className="font-mono">{row.getValue('sortOrder')}</span>,
    },
  ];

  const projectFilter = (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium">Project:</span>
      <Select
        value={selectedProjectId?.toString() ?? ''}
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
          <h1 className="text-2xl font-bold">Shop Drawing Sub-categories</h1>
          <p className="text-muted-foreground mt-1">Manage sub-categories (หมวดหมู่ย่อย) for shop drawings</p>
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
        title="Shop Drawing Sub-categories"
        description="Manage sub-categories (หมวดหมู่ย่อย) for shop drawings"
        queryKey={['shop-drawing-sub-categories', String(selectedProjectId)]}
        fetchFn={async () => {
          console.log(`Fetching Shop Sub-Categories for project ${selectedProjectId}`);
          const data = await drawingMasterDataService.getShopSubCategories(selectedProjectId);
          console.log('Shop Sub-Categories Data:', data);
          return data;
        }}
        createFn={(data) =>
          drawingMasterDataService.createShopSubCategory({
            ...data,
            projectId: selectedProjectId,
            isActive: data.isActive === 'true' || data.isActive === true,
          })
        }
        updateFn={(id, data) =>
          drawingMasterDataService.updateShopSubCategory(id, {
            ...data,
            isActive: data.isActive === 'true' || data.isActive === true,
          })
        }
        deleteFn={(id) => drawingMasterDataService.deleteShopSubCategory(id)}
        columns={columns}
        fields={[
          { name: 'subCategoryCode', label: 'Sub-category Code', type: 'text', required: true },
          { name: 'subCategoryName', label: 'Sub-category Name', type: 'text', required: true },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'isActive', label: 'Active', type: 'checkbox' },
          { name: 'sortOrder', label: 'Sort Order', type: 'text', required: true },
        ]}
        filters={projectFilter}
      />
    </div>
  );
}
