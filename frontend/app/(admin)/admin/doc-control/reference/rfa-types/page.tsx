'use client';

import { GenericCrudTable } from '@/components/admin/reference/generic-crud-table';
import { masterDataService } from '@/lib/services/master-data.service';
import { useContracts } from '@/hooks/use-master-data';
import { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { RfaType } from '@/types/master-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RfaTypesPage() {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const { data: contractsData = [] } = useContracts();
  // Ensure we consistently use an array
  const contracts = Array.isArray(contractsData) ? contractsData : [];

  const columns: ColumnDef<RfaType>[] = [
    {
      accessorKey: 'type_code',
      header: 'Code',
      cell: ({ row }) => <span className="font-mono font-bold">{row.getValue('type_code')}</span>,
    },
    {
      accessorKey: 'type_name_th',
      header: 'Name (TH)',
    },
    {
      accessorKey: 'type_name_en',
      header: 'Name (EN)',
    },
    {
      accessorKey: 'remark',
      header: 'Remark',
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

  const contractOptions = contracts.map((c: { id: number | string; contract_name?: string; contract_code?: string; contractName?: string; contractCode?: string }) => ({
    label: `${c.contractName || c.contract_name} (${c.contractCode || c.contract_code})`,
    value: String(c.id),
  }));

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="RFA Type"
        title="RFA Types Management"
        queryKey={['rfa-types', selectedContractId ?? 'all']}
        fetchFn={async () => {
          const items = await masterDataService.getRfaTypes(selectedContractId ? selectedContractId : undefined);
          // ADR-019: Map contractId INT → contract UUID for edit mode select matching
          return items.map((item) => {
            const rec = item as RfaType & { contract?: { id?: number | string; uuid?: string }; contract_id?: number | string };
            return {
              ...item,
              contractId: rec.contract?.id || rec.contract?.uuid || (rec.contract_id ? String(rec.contract_id) : null),
            } as RfaType;
          });
        }}
        createFn={(data) =>
          masterDataService.createRfaType(data as unknown as Parameters<typeof masterDataService.createRfaType>[0])
        }
        updateFn={(id, data) => masterDataService.updateRfaType(id, data)}
        deleteFn={(id) => masterDataService.deleteRfaType(id)}
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
                {contracts.map((c: { id: number | string; contract_name?: string; contract_code?: string; contractName?: string; contractCode?: string }) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.contractName || c.contract_name} ({c.contractCode || c.contract_code})
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
          { name: 'type_code', label: 'Code', type: 'text', required: true },
          { name: 'type_name_th', label: 'Name (TH)', type: 'text', required: true },
          { name: 'type_name_en', label: 'Name (EN)', type: 'text' },
          { name: 'remark', label: 'Remark', type: 'textarea' },
          { name: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
      />
    </div>
  );
}
