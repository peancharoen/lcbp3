// File: frontend/components/circulation/__tests__/circulation-list.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for CirculationList component
// - 2026-06-14: Render column cells in DataTable mock to cover list formatting logic

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CirculationList } from '../circulation-list';
import { Circulation, CirculationListResponse } from '@/types/circulation';
import { ColumnDef } from '@tanstack/react-table';
import React from 'react';

vi.mock('@/components/common/data-table', () => ({
  DataTable: ({ data, columns }: { data: Circulation[]; columns: ColumnDef<Circulation>[] }) => {
    type MockCellContext = {
      row: {
        original: Circulation;
        getValue: (key: string) => unknown;
      };
    };
    const renderCell = (column: ColumnDef<Circulation>, row: Circulation): React.ReactNode => {
      if (!column.cell || typeof column.cell !== 'function') return null;
      const key = 'accessorKey' in column ? String(column.accessorKey) : '';
      const context: MockCellContext = {
        row: {
          original: row,
          getValue: (valueKey: string) => row[valueKey as keyof Circulation],
        },
      };
      return (
        <div data-testid={`cell-${key || column.id || 'custom'}-${row.publicId}`}>
          {column.cell(context as never)}
        </div>
      );
    };
    return (
      <div data-testid="data-table">
        <span data-testid="row-count">{data.length} rows</span>
        <span data-testid="col-count">{columns.length} columns</span>
        {data.map((row) => (
          <div key={row.publicId} data-testid={`row-${row.publicId}`}>
            {columns.map((column) => (
              <React.Fragment key={String(('accessorKey' in column && column.accessorKey) || column.id)}>
                {renderCell(column, row)}
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const createRouting = (status: 'PENDING' | 'COMPLETED'): Circulation['routings'][number] => ({
  id: status === 'COMPLETED' ? 1 : 2,
  circulationId: 1,
  stepNumber: status === 'COMPLETED' ? 1 : 2,
  organizationId: 1,
  status,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
});

// Mock CirculationListResponse data ตาม ADR-019 (UUIDv7)
const mockResponse: CirculationListResponse = {
  data: [
    {
      publicId: '019505a1-7c3e-7000-8000-abc123def001',
      organizationId: 1,
      circulationNo: 'CIR-2026-001',
      subject: 'Test Circulation',
      statusCode: 'ACTIVE',
      createdByUserId: 1,
      organization: {
        publicId: '019505a1-7c3e-7000-8000-abc123def010',
        organizationName: 'Test Org',
        organizationCode: 'ORG',
      },
      routings: [createRouting('COMPLETED'), createRouting('PENDING')],
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    },
  ],
  meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

describe('CirculationList', () => {
  it('ควรเรนเดอร์ DataTable ได้ถูกต้อง', () => {
    render(<CirculationList data={mockResponse} />);
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  it('ควรแสดงจำนวน rows ถูกต้อง', () => {
    render(<CirculationList data={mockResponse} />);
    expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows');
  });

  it('ควรแสดงข้อมูล column cells หลักได้ถูกต้อง', () => {
    render(<CirculationList data={mockResponse} />);
    expect(screen.getByText('CIR-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Test Circulation')).toBeInTheDocument();
    expect(screen.getByText('Test Org')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('01 Jun 2026')).toBeInTheDocument();
    expect(screen.getByTitle('View Details').closest('a')).toHaveAttribute(
      'href',
      '/circulation/019505a1-7c3e-7000-8000-abc123def001'
    );
  });

  it('ควรแสดง fallback เมื่อไม่มี organization และ routings', () => {
    const response: CirculationListResponse = {
      data: [
        {
          publicId: '019505a1-7c3e-7000-8000-abc123def002',
          organizationId: 1,
          circulationNo: 'CIR-2026-002',
          subject: 'No Routing',
          statusCode: 'DRAFT',
          createdByUserId: 1,
          createdAt: '2026-06-02T00:00:00Z',
          updatedAt: '2026-06-02T00:00:00Z',
        },
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    render(<CirculationList data={response} />);
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(screen.getAllByText('-')).toHaveLength(2);
  });

  it('ควร map status variant ของสถานะ completed และ unknown โดยไม่ error', () => {
    const response: CirculationListResponse = {
      data: [
        {
          publicId: '019505a1-7c3e-7000-8000-abc123def003',
          organizationId: 1,
          circulationNo: 'CIR-2026-003',
          subject: 'Completed Routing',
          statusCode: 'COMPLETED',
          createdByUserId: 1,
          routings: [createRouting('COMPLETED')],
          createdAt: '2026-06-03T00:00:00Z',
          updatedAt: '2026-06-03T00:00:00Z',
        },
        {
          publicId: '019505a1-7c3e-7000-8000-abc123def004',
          organizationId: 1,
          circulationNo: 'CIR-2026-004',
          subject: 'Unknown Status',
          statusCode: 'ARCHIVED',
          createdByUserId: 1,
          createdAt: '2026-06-04T00:00:00Z',
          updatedAt: '2026-06-04T00:00:00Z',
        },
      ],
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    };
    render(<CirculationList data={response} />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('ARCHIVED')).toBeInTheDocument();
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('ควรแสดง meta total ที่ด้านล่างเมื่อมี meta', () => {
    render(<CirculationList data={mockResponse} />);
    expect(screen.getByText(/Showing 1 of 1 circulations/)).toBeInTheDocument();
  });

  it('ควรไม่แสดง meta เมื่อไม่มี meta', () => {
    const noMeta = { data: [] } as CirculationListResponse;
    render(<CirculationList data={noMeta} />);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('ควร return null เมื่อ data เป็น null/undefined', () => {
    const { container } = render(<CirculationList data={null as unknown as CirculationListResponse} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ควรเรนเดอร์ empty state เมื่อ data.data เป็น array ว่าง', () => {
    const emptyResponse: CirculationListResponse = {
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    };
    render(<CirculationList data={emptyResponse} />);
    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows');
    expect(screen.getByText(/Showing 0 of 0 circulations/)).toBeInTheDocument();
  });
});
