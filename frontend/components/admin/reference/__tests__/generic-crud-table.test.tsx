// File: frontend/components/admin/reference/__tests__/generic-crud-table.test.tsx
// Change Log
// - 2026-06-13: Add coverage for generic reference CRUD table states and create mutation.
// - 2026-08-18: Add coverage for `type: 'custom'` field rendering (ADR-046).

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { createTestQueryClient } from '@/lib/test-utils';
import { GenericCrudTable } from '../generic-crud-table';

type ReferenceRow = {
  id: number;
  publicId: string;
  code: string;
  name: string;
  active: boolean;
};

const rows: ReferenceRow[] = [
  {
    id: 1,
    publicId: '019505a1-7c3e-7000-8000-abc123def701',
    code: 'DISC',
    name: 'Discipline',
    active: true,
  },
];

const columns: ColumnDef<ReferenceRow>[] = [
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'name', header: 'Name' },
];

function renderTable(overrides?: Partial<React.ComponentProps<typeof GenericCrudTable<ReferenceRow>>>) {
  const { wrapper } = createTestQueryClient();
  const props: React.ComponentProps<typeof GenericCrudTable<ReferenceRow>> = {
    title: 'Reference Data',
    description: 'Manage reference data',
    entityName: 'Reference',
    queryKey: ['reference-test'],
    fetchFn: vi.fn().mockResolvedValue(rows),
    createFn: vi.fn().mockResolvedValue({ success: true }),
    updateFn: vi.fn().mockResolvedValue({ success: true }),
    deleteFn: vi.fn().mockResolvedValue({ success: true }),
    columns,
    fields: [
      { name: 'code', label: 'Code', type: 'text', required: true },
      { name: 'name', label: 'Name', type: 'textarea' },
      { name: 'active', label: 'Active', type: 'checkbox' },
    ],
    ...overrides,
  };
  return {
    ...render(<GenericCrudTable<ReferenceRow> {...props} />, { wrapper }),
    props,
  };
}

describe('GenericCrudTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders data rows returned by fetchFn', async () => {
    renderTable();
    expect(await screen.findByText('DISC')).toBeInTheDocument();
    expect(screen.getByText('Reference Data')).toBeInTheDocument();
    expect(screen.getByText('Discipline')).toBeInTheDocument();
  });

  it('renders empty state for wrapped empty data', async () => {
    renderTable({ fetchFn: vi.fn().mockResolvedValue({ data: [] }) });
    expect(await screen.findByText('No data found.')).toBeInTheDocument();
  });

  it('creates a new item from dialog form', async () => {
    const user = userEvent.setup();
    const createFn = vi.fn().mockResolvedValue({ success: true });
    renderTable({ createFn });
    await user.click(await screen.findByRole('button', { name: /add reference/i }));
    await user.type(screen.getByLabelText(/code/i), 'AREA');
    await user.type(screen.getByLabelText(/name/i), 'Area');
    await user.click(screen.getByRole('button', { name: /^add reference$/i }));
    await waitFor(() => {
      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AREA', name: 'Area', active: true }),
        expect.any(Object)
      );
    });
    expect(toast.success).toHaveBeenCalledWith('Reference created successfully');
  });

  it('render และเรียก render prop สำหรับ type: "custom" field (ADR-046)', async () => {
    const user = userEvent.setup();
    const createFn = vi.fn().mockResolvedValue({ success: true });
    const customRender = vi.fn(({ value, setValue }: { value: unknown; setValue: (v: unknown) => void }) => (
      <div data-testid="custom-field">
        <span data-testid="custom-value">{String(value ?? 'none')}</span>
        <button type="button" data-testid="custom-set" onClick={() => setValue('green')}>
          Set Green
        </button>
      </div>
    ));

    renderTable({
      createFn,
      fields: [
        { name: 'code', label: 'Code', type: 'text', required: true },
        {
          name: 'colorCode',
          label: 'Color',
          type: 'custom',
          render: customRender,
        },
      ],
    });

    await user.click(await screen.findByRole('button', { name: /add reference/i }));
    // ตรวจว่า render prop ถูกเรียก
    expect(customRender).toHaveBeenCalled();
    // ตรวจว่า custom field ปรากฏใน dialog
    expect(screen.getByTestId('custom-field')).toBeInTheDocument();
    // คลิกปุ่มใน custom field เพื่อ setValue
    await user.click(screen.getByTestId('custom-set'));
    // กรอก required field แล้ว submit
    await user.type(screen.getByLabelText(/code/i), 'AREA');
    await user.click(screen.getByRole('button', { name: /^add reference$/i }));
    await waitFor(() => {
      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AREA', colorCode: 'green' }),
        expect.any(Object)
      );
    });
  });
});
