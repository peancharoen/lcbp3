// File: frontend/components/documents/__tests__/bulk-tag-dialog.test.tsx
// Change Log:
// - 2026-09-12: Unit tests สำหรับ BulkTagDialog (Feature 253 — Phase 2 Frontend Unit)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkTagDialog } from '../bulk-tag-dialog';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string, _params?: Record<string, unknown>) => key,
}));

describe('BulkTagDialog (Feature 253 — Phase 2 Frontend Unit)', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('แสดง title + description พร้อม selectedCount', () => {
    render(
      <BulkTagDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        selectedCount={5}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText('document.bulk.tagDialog.title')).toBeInTheDocument();
    expect(screen.getByText('document.bulk.tagDialog.description')).toBeInTheDocument();
  });

  it('แสดง input สำหรับ add tags + remove tags', () => {
    render(
      <BulkTagDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        selectedCount={3}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText('document.bulk.tagDialog.addTags')).toBeInTheDocument();
    expect(screen.getByText('document.bulk.tagDialog.removeTags')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('document.bulk.tagDialog.addTagsPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('document.bulk.tagDialog.removeTagsPlaceholder')).toBeInTheDocument();
  });

  it('กรอก tag IDs + กด confirm → เรียก onConfirm ด้วย number[]', () => {
    render(
      <BulkTagDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        selectedCount={3}
        onConfirm={mockOnConfirm}
      />,
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '1, 2, 3' } });
    fireEvent.change(inputs[1], { target: { value: '4' } });
    fireEvent.click(screen.getByText('document.bulk.tagDialog.confirm'));

    expect(mockOnConfirm).toHaveBeenCalledWith([1, 2, 3], [4]);
  });

  it('กรองค่าที่ไม่ใช่ positive number ออก', () => {
    render(
      <BulkTagDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        selectedCount={3}
        onConfirm={mockOnConfirm}
      />,
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '1, abc, 0, -5, 2' } });
    fireEvent.click(screen.getByText('document.bulk.tagDialog.confirm'));

    // เก็บเฉพาะ 1 และ 2 (positive numbers > 0)
    expect(mockOnConfirm).toHaveBeenCalledWith([1, 2], []);
  });

  it('isLoading=true → แสดง processing + disable ปุ่ม', () => {
    render(
      <BulkTagDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        selectedCount={3}
        isLoading={true}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText('common.processing')).toBeInTheDocument();
  });

  it('ปิด dialog → reset addTags + removeTags', () => {
    render(
      <BulkTagDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        selectedCount={3}
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.click(screen.getByText('common.cancel'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
