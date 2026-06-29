// File: frontend/components/admin/__tests__/organization-dialog.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for OrganizationDialog component
// - 2026-06-13: Fix createTestQueryClient — ใช้ wrapper pattern ถูกต้อง

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrganizationDialog } from '../organization-dialog';
import { createTestQueryClient } from '@/lib/test-utils';

// Mock hooks
vi.mock('@/hooks/use-master-data', () => ({
  useCreateOrganization: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUpdateOrganization: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// Mock Dialog component เพื่อให้ทดสอบง่ายขึ้น (Radix UI ใน jsdom)
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderWithProvider(ui: React.ReactElement) {
  const { wrapper: Wrapper } = createTestQueryClient();
  return render(<Wrapper>{ui}</Wrapper>);
}

const mockOnOpenChange = vi.fn();

describe('OrganizationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควรไม่เรนเดอร์ Dialog เมื่อ open เป็น false', () => {
    renderWithProvider(
      <OrganizationDialog open={false} onOpenChange={mockOnOpenChange} />,
    );
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('ควรเรนเดอร์ Dialog เมื่อ open เป็น true', () => {
    renderWithProvider(
      <OrganizationDialog open={true} onOpenChange={mockOnOpenChange} />,
    );
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('ควรแสดง title "New Organization" เมื่อไม่มี organization prop', () => {
    renderWithProvider(
      <OrganizationDialog open={true} onOpenChange={mockOnOpenChange} />,
    );
    expect(screen.getByText('New Organization')).toBeInTheDocument();
  });

  it('ควรแสดง title "Edit Organization" เมื่อมี organization prop', () => {
    const mockOrg = {
      publicId: '019505a1-7c3e-7000-8000-abc123def001',
      organizationCode: 'OWNER',
      organizationName: 'Test Owner Co., Ltd.',
      isActive: true,
    } as any;
    renderWithProvider(
      <OrganizationDialog open={true} onOpenChange={mockOnOpenChange} organization={mockOrg} />,
    );
    expect(screen.getByText('Edit Organization')).toBeInTheDocument();
  });

  it('ควรแสดงปุ่ม Cancel และ Create Organization สำหรับ New', () => {
    renderWithProvider(
      <OrganizationDialog open={true} onOpenChange={mockOnOpenChange} />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Organization' })).toBeInTheDocument();
  });

  it('ควรแสดงปุ่ม Save Changes สำหรับ Edit', () => {
    const mockOrg = {
      publicId: '019505a1-7c3e-7000-8000-abc123def001',
      organizationCode: 'OWNER',
      organizationName: 'Test Owner Co., Ltd.',
      isActive: true,
    } as any;
    renderWithProvider(
      <OrganizationDialog open={true} onOpenChange={mockOnOpenChange} organization={mockOrg} />,
    );
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('ควรเรียก onOpenChange(false) เมื่อคลิก Cancel', async () => {
    renderWithProvider(
      <OrganizationDialog open={true} onOpenChange={mockOnOpenChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('ควรแสดง validation error เมื่อ submit form ว่างเปล่า', async () => {
    renderWithProvider(
      <OrganizationDialog open={true} onOpenChange={mockOnOpenChange} />,
    );
    const form = screen.getByRole('button', { name: 'Create Organization' }).closest('form');
    if (form) fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText('Organization Code is required')).toBeInTheDocument();
    });
  });
});
