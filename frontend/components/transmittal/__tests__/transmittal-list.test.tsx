// File: frontend/components/transmittal/__tests__/transmittal-list.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for TransmittalList component

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransmittalList } from '../transmittal-list';
import { Transmittal } from '@/types/transmittal';

// Mock DataTable เนื่องจากเป็น complex component
vi.mock('@/components/common/data-table', () => ({
  DataTable: ({ data, columns }: { data: unknown[]; columns: unknown[] }) => (
    <div data-testid="data-table">
      <span data-testid="row-count">{data.length} rows</span>
      <span data-testid="col-count">{columns.length} columns</span>
    </div>
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock Transmittal data ตาม ADR-019 (UUIDv7)
const mockTransmittal: Transmittal = {
  publicId: '019505a1-7c3e-7000-8000-abc123def001',
  transmittalNo: 'TRS-2026-001',
  subject: 'Test Transmittal Subject',
  purpose: 'FOR_APPROVAL',
  items: [
    { publicId: '019505a1-7c3e-7000-8000-abc123def002', description: 'Item 1' } as any,
    { publicId: '019505a1-7c3e-7000-8000-abc123def003', description: 'Item 2' } as any,
  ],
  createdAt: '2026-06-01T00:00:00Z',
} as any;

describe('TransmittalList', () => {
  it('ควรเรนเดอร์ DataTable ได้ถูกต้อง', () => {
    render(<TransmittalList data={[mockTransmittal]} />);
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  it('ควร pass data ถูกต้องให้ DataTable', () => {
    render(<TransmittalList data={[mockTransmittal]} />);
    expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows');
  });

  it('ควร pass columns ถูกต้องให้ DataTable (6 columns)', () => {
    render(<TransmittalList data={[mockTransmittal]} />);
    expect(screen.getByTestId('col-count')).toHaveTextContent('6 columns');
  });

  it('ควร return null เมื่อ data เป็น null/undefined', () => {
    const { container } = render(<TransmittalList data={null as any} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ควรเรนเดอร์ empty state เมื่อ data เป็น array ว่าง', () => {
    render(<TransmittalList data={[]} />);
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows');
  });
});
