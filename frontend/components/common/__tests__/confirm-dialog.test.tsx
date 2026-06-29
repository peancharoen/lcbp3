// File: frontend/components/common/__tests__/confirm-dialog.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for ConfirmDialog component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../confirm-dialog';

describe('ConfirmDialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควรเรนเดอร์เนื้อหาและปุ่มต่างๆ ได้อย่างถูกต้องเมื่อเปิดใช้งาน', () => {
    const mockOnOpenChange = vi.fn();
    const mockOnConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Confirm Delete"
        description="Are you sure you want to delete?"
        onConfirm={mockOnConfirm}
        confirmText="Yes, Delete"
        cancelText="Cancel Action"
      />
    );
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Action' })).toBeInTheDocument();
  });

  it('ควรเรียก onConfirm เมื่อกดปุ่มยืนยันสำเร็จ', () => {
    const mockOnOpenChange = vi.fn();
    const mockOnConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        title="Confirm Action"
        description="Proceed?"
        onConfirm={mockOnConfirm}
      />
    );
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmBtn);
    expect(mockOnConfirm).toHaveBeenCalled();
  });
});
