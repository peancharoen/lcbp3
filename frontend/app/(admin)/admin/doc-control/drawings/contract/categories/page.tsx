'use client';

import React, { useState } from 'react';
import { GenericCrudTable } from '@/components/admin/reference/generic-crud-table';
import { ColumnDef } from '@tanstack/react-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useProjects } from '@/hooks/use-master-data';
import {
  drawingMasterDataService,
  ContractCategory,
  ContractSubCategory,
  CreateContractCategoryDto,
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
        fetchFn={async () => {
          console.log(`Fetching Contract Categories for project ${selectedProjectId}`);
          const data = await drawingMasterDataService.getContractCategories(selectedProjectId);
          console.log('Contract Categories Data:', data);
          return data;
        }}
        createFn={(data: Record<string, unknown>) => drawingMasterDataService.createContractCategory({ ...(data as unknown as CreateContractCategoryDto), projectId: selectedProjectId })}
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

      <div className="mt-8 border-t pt-8">
        <CategoryMappingSection projectId={selectedProjectId} />
      </div>
    </div>
  );
}

// =====================================================
// Error Boundary to prevent mapping section from crashing the page
// =====================================================
class MappingErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-200 bg-red-50 rounded-md text-sm text-red-700">
          <p className="font-medium">Failed to load mapping section</p>
          <p className="text-xs mt-1">{this.state.error?.message || 'Unknown error'}</p>
          <button className="mt-2 text-xs underline" onClick={() => this.setState({ hasError: false, error: null })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CategoryMappingSection({ projectId }: { projectId: number }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Category Mappings (Map Sub-categories to Categories)</h2>
      <div className="bg-muted/30 p-4 rounded-lg border-dashed border">
        <p className="text-sm text-muted-foreground">Select a category to view and manage its sub-categories.</p>
        <MappingErrorBoundary>
          <ManageMappings projectId={projectId} />
        </MappingErrorBoundary>
      </div>
    </div>
  );
}

function ManageMappings({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('');

  const {
    data: rawCategories,
    isLoading: isLoadingCats,
    isError: isCatError,
  } = useQuery({
    queryKey: ['contract-categories-mapping', String(projectId)],
    queryFn: () => drawingMasterDataService.getContractCategories(projectId),
  });

  const {
    data: rawSubCategories,
    isLoading: isLoadingSubCats,
    isError: isSubCatError,
  } = useQuery({
    queryKey: ['contract-sub-categories-mapping', String(projectId)],
    queryFn: () => drawingMasterDataService.getContractSubCategories(projectId),
  });

  const { data: rawMappings, isLoading: isLoadingMappings } = useQuery({
    queryKey: ['contract-mappings', String(projectId), selectedCat],
    queryFn: () =>
      drawingMasterDataService.getContractMappings(projectId, selectedCat ? parseInt(selectedCat) : undefined),
    enabled: !!selectedCat,
  });

  // Ensure data is always an array - defensive against unexpected API responses
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  const subCategories = Array.isArray(rawSubCategories) ? rawSubCategories : [];
  const mappings = Array.isArray(rawMappings) ? rawMappings : [];

  const createMutation = useMutation({
    mutationFn: (data: { projectId: number; categoryId: number; subCategoryId: number }) =>
      drawingMasterDataService.createContractMapping(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-mappings'] });
      toast.success('Mapping created');
      setSelectedSubCat('');
    },
    onError: () => toast.error('Failed to create mapping'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => drawingMasterDataService.deleteContractMapping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-mappings'] });
      toast.success('Mapping removed');
    },
    onError: () => toast.error('Failed to delete mapping'),
  });

  const handleAdd = () => {
    if (!selectedCat || !selectedSubCat) return;
    createMutation.mutate({
      projectId,
      categoryId: parseInt(selectedCat),
      subCategoryId: parseInt(selectedSubCat),
    });
  };

  if (isLoadingCats || isLoadingSubCats) {
    return <p className="text-sm text-muted-foreground py-2">Loading data...</p>;
  }

  if (isCatError || isSubCatError) {
    return (
      <p className="text-sm text-red-500 py-2">
        Failed to load categories or sub-categories. Please check your permissions.
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 mt-4">
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
                        !mappings.find((m: Record<string, unknown>) => {
                          const sub = m.subCategory as { id?: number } | undefined;
                          return sub?.id === s.id;
                        })
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
            {isLoadingMappings ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading mappings...</div>
            ) : mappings.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No sub-categories mapped yet.</div>
            ) : (
              <div className="divide-y">
                {mappings
                  .filter((m: Record<string, unknown>) => m && m.subCategory)
                  .map((m: { id: number; subCategory: ContractSubCategory }) => (
                    <div key={m.id} className="p-2 grid grid-cols-[1fr,auto] gap-2 items-center">
                      <span className="text-sm">
                        {m.subCategory?.subCatCode ?? '?'} - {m.subCategory?.subCatName ?? 'Unknown'}
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
