// File: frontend/components/documents/__tests__/bulk-components.test.tsx
// Change Log:
// - 2026-09-12: Unit tests สำหรับ BulkActionBar + BulkResultDialog (Feature 253 — Phase 2 Frontend Unit)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionBar } from '../bulk-action-bar';
import { BulkResultDialog } from '../bulk-result-dialog';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string, _params?: Record<string, unknown>) => key,
}));

describe('BulkActionBar (Feature 253 — Phase 2 Frontend Unit)', () => {
  const mockOnBulkCancel = vi.fn();
  const mockOnBulkTag = vi.fn();
  const mockOnBulkExport = vi.fn();
  const mockOnClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('return null เมื่อ selectedCount=0', () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={0}
        onBulkCancel={mockOnBulkCancel}
        onBulkTag={mockOnBulkTag}
        onBulkExport={mockOnBulkExport}
        onClear={mockOnClear}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('แสดง count + ปุ่ม export/tag/cancel เมื่อ selectedCount > 0', () => {
    render(
      <BulkActionBar
        selectedCount={5}
        onBulkCancel={mockOnBulkCancel}
        onBulkTag={mockOnBulkTag}
        onBulkExport={mockOnBulkExport}
        onClear={mockOnClear}
      />,
    );

    expect(screen.getByText('document.bulk.selected')).toBeInTheDocument();
    expect(screen.getByText('document.bulk.export')).toBeInTheDocument();
    expect(screen.getByText('document.bulk.tag')).toBeInTheDocument();
    expect(screen.getByText('document.bulk.cancel')).toBeInTheDocument();
  });

  it('คลิก export → เรียก onBulkExport', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        onBulkCancel={mockOnBulkCancel}
        onBulkTag={mockOnBulkTag}
        onBulkExport={mockOnBulkExport}
        onClear={mockOnClear}
      />,
    );

    fireEvent.click(screen.getByText('document.bulk.export'));
    expect(mockOnBulkExport).toHaveBeenCalled();
  });

  it('คลิก tag → เรียก onBulkTag', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        onBulkCancel={mockOnBulkCancel}
        onBulkTag={mockOnBulkTag}
        onBulkExport={mockOnBulkExport}
        onClear={mockOnClear}
      />,
    );

    fireEvent.click(screen.getByText('document.bulk.tag'));
    expect(mockOnBulkTag).toHaveBeenCalled();
  });

  it('คลิก cancel → เรียก onBulkCancel', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        onBulkCancel={mockOnBulkCancel}
        onBulkTag={mockOnBulkTag}
        onBulkExport={mockOnBulkExport}
        onClear={mockOnClear}
      />,
    );

    fireEvent.click(screen.getByText('document.bulk.cancel'));
    expect(mockOnBulkCancel).toHaveBeenCalled();
  });

  it('isLoading=true → disable ทุกปุ่ม', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        onBulkCancel={mockOnBulkCancel}
        onBulkTag={mockOnBulkTag}
        onBulkExport={mockOnBulkExport}
        onClear={mockOnClear}
        isLoading={true}
      />,
    );

    expect(screen.getByText('document.bulk.export')).toBeDisabled();
    expect(screen.getByText('document.bulk.tag')).toBeDisabled();
    expect(screen.getByText('document.bulk.cancel')).toBeDisabled();
  });
});

describe('BulkResultDialog (Feature 253 — Phase 2 Frontend Unit)', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('แสดง title + summary (total/success/failed)', () => {
    render(
      <BulkResultDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        total={10}
        success={8}
        failed={2}
      />,
    );

    expect(screen.getByText('document.bulk.resultDialog.title')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('แสดง failed items list เมื่อ failed > 0 + มี failedItems', () => {
    render(
      <BulkResultDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        total={3}
        success={1}
        failed={2}
        failedItems={['CORR-001', 'CORR-002']}
      />,
    );

    expect(screen.getByText('document.bulk.resultDialog.failedItems')).toBeInTheDocument();
    expect(screen.getByText('CORR-001')).toBeInTheDocument();
    expect(screen.getByText('CORR-002')).toBeInTheDocument();
  });

  it('ไม่แสดง failed items list เมื่อ failed=0', () => {
    render(
      <BulkResultDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        total={5}
        success={5}
        failed={0}
      />,
    );

    expect(screen.queryByText('document.bulk.resultDialog.failedItems')).not.toBeInTheDocument();
  });

  it('คลิก close → เรียก onOpenChange(false)', () => {
    render(
      <BulkResultDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        total={5}
        success={5}
        failed={0}
      />,
    );

    fireEvent.click(screen.getByText('document.bulk.resultDialog.close'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
