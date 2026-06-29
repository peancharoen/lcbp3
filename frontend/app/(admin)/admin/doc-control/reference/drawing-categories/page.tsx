'use client';

import { GenericCrudTable } from '@/components/admin/reference/generic-crud-table';
import { masterDataService } from '@/lib/services/master-data.service';
import { ColumnDef } from '@tanstack/react-table';
import { DrawingCategory } from '@/types/master-data';

export default function DrawingCategoriesPage() {
  const columns: ColumnDef<DrawingCategory>[] = [
    {
      accessorKey: 'sub_type_code',
      header: 'Code',
      cell: ({ row }) => <span className="font-mono font-bold">{row.getValue('sub_type_code')}</span>,
    },
    {
      accessorKey: 'sub_type_name',
      header: 'Name',
    },
    {
      accessorKey: 'sub_type_number',
      header: 'Running Code',
      cell: ({ row }) => <span className="font-mono">{row.getValue('sub_type_number') || '-'}</span>,
    },
  ];

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Drawing Category (Sub-Type)"
        title="Drawing Categories Management"
        description="Manage drawing sub-types and categories"
        queryKey={['drawing-categories']}
        fetchFn={async () => {
          const data = await masterDataService.getSubTypes(1);
          return data as (DrawingCategory & { uuid?: string })[];
        }}
        createFn={(data: Record<string, unknown>) =>
          masterDataService.createSubType({
            ...(data as unknown as Parameters<typeof masterDataService.createSubType>[0]),
            contractId: 1,
            correspondenceTypeId: 3,
          })
        }
        updateFn={(id, data) => masterDataService.updateRfaType(id, data as Parameters<typeof masterDataService.updateRfaType>[1])}
        deleteFn={(id) => masterDataService.deleteRfaType(id)}
        columns={columns as unknown as ColumnDef<{ id?: number; uuid?: string }>[]}
        fields={[
          { name: 'sub_type_code', label: 'Code', type: 'text', required: true },
          { name: 'sub_type_name', label: 'Name', type: 'text', required: true },
          { name: 'sub_type_number', label: 'Running Code', type: 'text' },
          { name: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
      />
    </div>
  );
}
