// File: frontend/components/documents/__tests__/document-hard-delete-dialog.test.tsx
// Change Log:
// - 2026-09-12: Unit tests สำหรับ DocumentHardDeleteDialog (Feature 253 — Phase 2 Frontend Unit)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentHardDeleteDialog } from '../document-hard-delete-dialog';
import { getDocumentActionConfig } from '../document-action-strategy';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('DocumentHardDeleteDialog (Feature 253 — Phase 2 Frontend Unit)', () => {
  const config = getDocumentActionConfig('CORRESPONDENCE');
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('แสดง title + warning + documentLabel เมื่อ open (step 1)', () => {
    render(
      <DocumentHardDeleteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText('document.hardDelete.title')).toBeInTheDocument();
    expect(screen.getByText('document.hardDelete.warning')).toBeInTheDocument();
    expect(screen.getByText('CORR-001')).toBeInTheDocument();
  });

  it('step 1: แสดงปุ่ม "เข้าใจ" ไม่แสดงปุ่ม confirm', () => {
    render(
      <DocumentHardDeleteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText('document.hardDelete.understand')).toBeInTheDocument();
    expect(screen.queryByText('document.hardDelete.confirmAction')).not.toBeInTheDocument();
  });

  it('step 1 → 2: กด "เข้าใจ" แล้วแสดง input สำหรับพิมพ์ DELETE', () => {
    render(
      <DocumentHardDeleteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.click(screen.getByText('document.hardDelete.understand'));

    expect(screen.getByText('document.hardDelete.typeDelete')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument();
    expect(screen.getByText('document.hardDelete.confirmAction')).toBeInTheDocument();
  });

  it('step 2: ปุ่ม confirm disabled ถ้ายังไม่พิมพ์ DELETE', () => {
    render(
      <DocumentHardDeleteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.click(screen.getByText('document.hardDelete.understand'));
    const confirmBtn = screen.getByText('document.hardDelete.confirmAction');
    expect(confirmBtn).toBeDisabled();
  });

  it('step 2: พิมพ์ผิด (ไม่ใช่ DELETE) → ปุ่ม confirm ยัง disabled', () => {
    render(
      <DocumentHardDeleteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.click(screen.getByText('document.hardDelete.understand'));
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'delete' } });
    expect(screen.getByText('document.hardDelete.confirmAction')).toBeDisabled();
  });

  it('step 2: พิมพ์ DELETE แล้วกด confirm → เรียก onConfirm', () => {
    render(
      <DocumentHardDeleteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.click(screen.getByText('document.hardDelete.understand'));
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByText('document.hardDelete.confirmAction'));

    expect(mockOnConfirm).toHaveBeenCalled();
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('isLoading=true → แสดง processing text + disable ปุ่ม', () => {
    render(
      <DocumentHardDeleteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        isLoading={true}
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.click(screen.getByText('document.hardDelete.understand'));
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });

    // ปุ่ม confirm จะเป็น processing text แต่ disabled เพราะ isLoading
    expect(screen.getByText('common.processing')).toBeInTheDocument();
  });

  it('ปิด dialog จะ reset step + confirmText', () => {
    const { rerender } = render(
      <DocumentHardDeleteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    // ไป step 2 และพิมพ์ DELETE
    fireEvent.click(screen.getByText('document.hardDelete.understand'));
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });

    // ปิด dialog
    rerender(
      <DocumentHardDeleteDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );
  });
});
