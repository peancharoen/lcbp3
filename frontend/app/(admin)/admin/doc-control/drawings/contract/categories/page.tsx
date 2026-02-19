'use client';

import { useState } from 'react';
import { GenericCrudTable } from '@/components/admin/reference/generic-crud-table';
import { ColumnDef } from '@tanstack/react-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useProjects } from '@/hooks/use-master-data';
import {
  drawingMasterDataService,
  ContractCategory,
  ContractSubCategory,
} from '@/lib/services/drawing-master-data.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Category {
  id: number;
  catCode: string;
  catName: string;
  description?: string;
  sortOrder: number;
}

export default function ContractCategoriesPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();

  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: 'catCode',
      header: 'Code',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.getValue('catCode')}
        </Badge>
      ),
    },
    {
      accessorKey: 'catName',
      header: 'Category Name',
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.getValue('description') || '-'}</span>,
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
          <h1 className="text-2xl font-bold">Contract Drawing Categories</h1>
          <p className="text-muted-foreground mt-1">Manage main categories (หมวดหมู่หลัก) for contract drawings</p>
        </div>
        {projectFilter}
        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
          Please select a project to manage categories.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Category"
        title="Contract Drawing Categories"
        description="Manage main categories (หมวดหมู่หลัก) for contract drawings"
        queryKey={['contract-drawing-categories', String(selectedProjectId)]}
        fetchFn={() => drawingMasterDataService.getContractCategories(selectedProjectId)}
        createFn={(data) => drawingMasterDataService.createContractCategory({ ...data, projectId: selectedProjectId })}
        updateFn={(id, data) => drawingMasterDataService.updateContractCategory(id, data)}
        deleteFn={(id) => drawingMasterDataService.deleteContractCategory(id)}
        columns={columns}
        fields={[
          { name: 'catCode', label: 'Category Code', type: 'text', required: true },
          { name: 'catName', label: 'Category Name', type: 'text', required: true },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'sortOrder', label: 'Sort Order', type: 'text', required: true },
        ]}
        filters={projectFilter}
      />

      {/*
        Note: For mapping, we should ideally have a separate "Mappings" column or action button.
        Since GenericCrudTable might not support custom action columns easily without modification,
        we are currently just listing categories. To add mapping functionality, we might need
        to either extend GenericCrudTable or create a dedicated page for mappings.

        Given the constraints, I will add a "Mapped Sub-categories" management section
        that opens when clicking a category ROW or adding a custom action if GenericCrudTable supports it.
        For now, let's assume we need to extend GenericCrudTable or replace it to support this specific requirement.
        
        However, to keep it simple and consistent:
        Let's add a separate section below the table or a dialog triggered by a custom cell.
       */}
      <div className="mt-8 border-t pt-8">
        <CategoryMappingSection projectId={selectedProjectId} />
      </div>
    </div>
  );
}

function CategoryMappingSection({ projectId }: { projectId: number }) {
  // ... logic to manage mappings would go here ...
  // But to properly implement this, we need a full mapping UI.
  // Let's defer this implementation pattern to a separate component to keep this file clean
  // and just mount it here.
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Category Mappings (Map Sub-categories to Categories)</h2>
      <div className="bg-muted/30 p-4 rounded-lg border-dashed border">
        <p className="text-sm text-muted-foreground">Select a category to view and manage its sub-categories.</p>
        {/* 
                  Real implementation would be complex here. 
                  Better approach: Add a "Manage Sub-categories" button to the Categories table if possible.
                  Or simpler: A separate "Mapping" page.
                */}
        <ManageMappings projectId={projectId} />
      </div>
    </div>
  );
}

function ManageMappings({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('');

  const { data: categories = [] } = useQuery({
    queryKey: ['contract-categories', String(projectId)],
    queryFn: () => drawingMasterDataService.getContractCategories(projectId),
  });

  const { data: subCategories = [] } = useQuery({
    queryKey: ['contract-sub-categories', String(projectId)],
    queryFn: () => drawingMasterDataService.getContractSubCategories(projectId),
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ['contract-mappings', String(projectId), selectedCat],
    queryFn: () =>
      drawingMasterDataService.getContractMappings(projectId, selectedCat ? parseInt(selectedCat) : undefined),
    enabled: !!selectedCat,
  });

  const createMutation = useMutation({
    mutationFn: drawingMasterDataService.createContractMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-mappings'] });
      toast.success('Mapping created');
      setSelectedSubCat('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: drawingMasterDataService.deleteContractMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-mappings'] });
      toast.success('Mapping removed');
    },
  });

  const handleAdd = () => {
    if (!selectedCat || !selectedSubCat) return;
    createMutation.mutate({
      projectId,
      categoryId: parseInt(selectedCat),
      subCategoryId: parseInt(selectedSubCat),
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Category</label>
        <Select value={selectedCat} onValueChange={setSelectedCat}>
          <SelectTrigger>
            <SelectValue placeholder="Select Category..." />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c: ContractCategory) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.catCode} - {c.catName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCat && (
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Add Sub-Category</label>
              <Select value={selectedSubCat} onValueChange={setSelectedSubCat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Sub-Category to add..." />
                </SelectTrigger>
                <SelectContent>
                  {subCategories
                    .filter(
                      (s: ContractSubCategory) =>
                        !mappings.find((m: { subCategory: { id: number } }) => m.subCategory.id === s.id)
                    )
                    .map((s: ContractSubCategory) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.subCatCode} - {s.subCatName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={!selectedSubCat || createMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" /> Add
            </Button>
          </div>

          <div className="border rounded-md">
            <div className="p-2 bg-muted/50 font-medium text-sm grid grid-cols-[1fr,auto] gap-2">
              <span>Mapped Sub-Categories</span>
              <span>Action</span>
            </div>
            {mappings.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No sub-categories mapped yet.</div>
            ) : (
              <div className="divide-y">
                {mappings.map((m: { id: number; subCategory: ContractSubCategory }) => (
                  <div key={m.id} className="p-2 grid grid-cols-[1fr,auto] gap-2 items-center">
                    <span className="text-sm">
                      {m.subCategory.subCatCode} - {m.subCategory.subCatName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(m.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
