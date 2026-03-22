'use client';

import { GenericCrudTable } from '@/components/admin/reference/generic-crud-table';
import { masterDataService } from '@/lib/services/master-data.service';
import { useContracts } from '@/hooks/use-master-data';
import { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DisciplinesPage() {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const { data: contractsData = [] } = useContracts();
  // Ensure we consistently use an array
  const contracts = Array.isArray(contractsData) ? contractsData : [];

  const columns: ColumnDef<unknown>[] = [
    {
      accessorKey: 'disciplineCode',
      header: 'Code',
      cell: ({ row }) => <span className="font-mono font-bold">{row.getValue('disciplineCode')}</span>,
    },
    {
      accessorKey: 'codeNameTh',
      header: 'Name (TH)',
    },
    {
      accessorKey: 'codeNameEn',
      header: 'Name (EN)',
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            row.getValue('isActive') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {row.getValue('isActive') ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const contractOptions = contracts.map((c: unknown) => ({
    label: `${c.contractName} (${c.contractCode})`,
    value: String(c.id),
  }));

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Discipline"
        title="Disciplines Management"
        description="Manage system disciplines (e.g., ARCH, STR, MEC)"
        queryKey={['disciplines', selectedContractId ?? 'all']}
        fetchFn={async () => {
          const items = await masterDataService.getDisciplines(selectedContractId ? selectedContractId : undefined);
          // ADR-019: Map contractId INT → contract UUID for edit mode select matching
          return (items as Record<string, unknown>[]).map((item) => {
            const rec = item as { contract?: { id?: number; uuid?: string }; contractId?: number };
            return {
              ...item,
              contractId: rec.contract?.id || rec.contract?.uuid || String(rec.contractId),
            };
          });
        }}
        createFn={(data) =>
          masterDataService.createDiscipline(
            data as unknown as Parameters<typeof masterDataService.createDiscipline>[0]
          )
        }
        updateFn={(_id, _data) => Promise.reject('Not implemented yet')}
        deleteFn={(id) => masterDataService.deleteDiscipline(id)}
        columns={columns}
        filters={
          <div className="w-[300px]">
            <Select
              value={selectedContractId || 'all'}
              onValueChange={(val) => setSelectedContractId(val === 'all' ? null : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Contract" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map((c: unknown) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.contractName} ({c.contractCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        fields={[
          {
            name: 'contractId',
            label: 'Contract',
            type: 'select',
            required: true,
            options: contractOptions,
          },
          {
            name: 'disciplineCode',
            label: 'Code',
            type: 'text',
            required: true,
          },
          {
            name: 'codeNameTh',
            label: 'Name (TH)',
            type: 'text',
            required: true,
          },
          { name: 'codeNameEn', label: 'Name (EN)', type: 'text' },
          { name: 'isActive', label: 'Active', type: 'checkbox' },
        ]}
      />
    </div>
  );
}
