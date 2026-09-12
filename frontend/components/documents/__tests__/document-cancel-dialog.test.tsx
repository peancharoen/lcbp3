// File: frontend/components/documents/__tests__/document-cancel-dialog.test.tsx
// Change Log:
// - 2026-09-12: Unit tests สำหรับ DocumentCancelDialog (Feature 253 — Phase 2 Frontend Unit)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentCancelDialog } from '../document-cancel-dialog';
import { getDocumentActionConfig } from '../document-action-strategy';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('DocumentCancelDialog (Feature 253 — Phase 2 Frontend Unit)', () => {
  const config = getDocumentActionConfig('CORRESPONDENCE');
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('แสดง title + description + documentLabel เมื่อ open', () => {
    render(
      <DocumentCancelDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    // confirmKey และ description ใช้ key เดียวกัน ('document.cancel.confirm') → มี 2 elements
    expect(screen.getAllByText('document.cancel.confirm').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('CORR-001')).toBeInTheDocument();
  });

  it('เรียก onConfirm ด้วย reason ที่กรอกเมื่อกด confirm', () => {
    render(
      <DocumentCancelDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'ไม่ต้องการแล้ว' } });
    fireEvent.click(screen.getByText('document.cancel.confirmAction'));

    expect(mockOnConfirm).toHaveBeenCalledWith('ไม่ต้องการแล้ว');
  });

  it('trim reason ก่อนส่ง onConfirm', () => {
    render(
      <DocumentCancelDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  มีช่องว่าง  ' } });
    fireEvent.click(screen.getByText('document.cancel.confirmAction'));

    expect(mockOnConfirm).toHaveBeenCalledWith('มีช่องว่าง');
  });

  it('ปิด dialog เมื่อกด cancel button', () => {
    render(
      <DocumentCancelDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.click(screen.getByText('common.cancel'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('disable ปุ่มเมื่อ isLoading=true และแสดง processing text', () => {
    render(
      <DocumentCancelDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        isLoading={true}
        onConfirm={mockOnConfirm}
      />,
    );

    const confirmBtn = screen.getByText('common.processing');
    expect(confirmBtn).toBeDisabled();
  });

  it('clear reason เมื่อปิด dialog', () => {
    const { rerender } = render(
      <DocumentCancelDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'reason' } });
    expect(textarea.value).toBe('reason');

    // ปิด dialog
    rerender(
      <DocumentCancelDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        onConfirm={mockOnConfirm}
      />,
    );
  });
});
