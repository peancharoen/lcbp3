'use client';

import { GenericCrudTable } from '@/components/admin/reference/generic-crud-table';
import { masterDataService } from '@/lib/services/master-data.service';
import { ColumnDef } from '@tanstack/react-table';
import { CorrespondenceType } from '@/types/master-data';

export default function CorrespondenceTypesPage() {
  const columns: ColumnDef<CorrespondenceType>[] = [
    {
      accessorKey: 'type_code',
      header: 'Code',
      cell: ({ row }) => <span className="font-mono font-bold">{row.getValue('type_code')}</span>,
    },
    {
      accessorKey: 'type_name',
      header: 'Name',
    },
    {
      accessorKey: 'sort_order',
      header: 'Sort Order',
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            row.getValue('is_active') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {row.getValue('is_active') ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Correspondence Type"
        title="Correspondence Types Management"
        description="Manage global correspondence types (e.g., LETTER, TRANSMITTAL)"
        queryKey={['correspondence-types']}
        fetchFn={() => masterDataService.getCorrespondenceTypes()}
        createFn={(data: Record<string, unknown>) =>
          masterDataService.createCorrespondenceType(
            data as unknown as Parameters<typeof masterDataService.createCorrespondenceType>[0]
          )
        }
        updateFn={(id, data) => masterDataService.updateCorrespondenceType(id, data)}
        deleteFn={(id) => masterDataService.deleteCorrespondenceType(id)}
        columns={columns}
        fields={[
          { name: 'type_code', label: 'Code', type: 'text', required: true },
          { name: 'type_name', label: 'Name', type: 'text', required: true },
          { name: 'sort_order', label: 'Sort Order', type: 'text' },
          { name: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
      />
    </div>
  );
}
