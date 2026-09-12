// File: frontend/components/documents/__tests__/document-row-actions.test.tsx
// Change Log:
// - 2026-09-12: Unit tests สำหรับ DocumentRowActions (Feature 253 — Phase 2 Frontend Unit)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentRowActions } from '../document-row-actions';
import { getDocumentActionConfig } from '../document-action-strategy';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockHasPermission = vi.fn();
vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: () => ({ hasPermission: mockHasPermission }),
}));

describe('DocumentRowActions (Feature 253 — Phase 2 Frontend Unit)', () => {
  const config = getDocumentActionConfig('CORRESPONDENCE');
  const mockOnCancel = vi.fn();
  const mockOnHardDelete = vi.fn();
  const mockOnMetadataEdit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('return null ถ้า user ไม่มี permission ใดๆ', () => {
    mockHasPermission.mockReturnValue(false);
    const { container } = render(
      <DocumentRowActions
        config={config}
        onCancel={mockOnCancel}
        onHardDelete={mockOnHardDelete}
        onMetadataEdit={mockOnMetadataEdit}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('แสดงเมนู ⋯ เมื่อมี permission อย่างน้อย 1 อย่าง', () => {
    mockHasPermission.mockImplementation((perm: string) => perm === 'document.cancel');
    render(
      <DocumentRowActions
        config={config}
        onCancel={mockOnCancel}
        onHardDelete={mockOnHardDelete}
        onMetadataEdit={mockOnMetadataEdit}
      />,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('แสดง cancel action เมื่อมี document.cancel permission', async () => {
    mockHasPermission.mockImplementation((perm: string) => perm === 'document.cancel');
    const user = userEvent.setup();
    render(
      <DocumentRowActions
        config={config}
        onCancel={mockOnCancel}
        onHardDelete={mockOnHardDelete}
        onMetadataEdit={mockOnMetadataEdit}
      />,
    );
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('document.cancel.title')).toBeInTheDocument();
    });
  });

  it('แสดง hard-delete action เมื่อมี system.manage_all permission', async () => {
    mockHasPermission.mockImplementation((perm: string) => perm === 'system.manage_all');
    const user = userEvent.setup();
    render(
      <DocumentRowActions
        config={config}
        onCancel={mockOnCancel}
        onHardDelete={mockOnHardDelete}
        onMetadataEdit={mockOnMetadataEdit}
      />,
    );
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('document.hardDelete.title')).toBeInTheDocument();
    });
  });

  it('แสดง metadata edit action เมื่อมี edit_metadata permission', async () => {
    mockHasPermission.mockImplementation(
      (perm: string) => perm === '/api/v1/correspondences.edit_metadata',
    );
    const user = userEvent.setup();
    render(
      <DocumentRowActions
        config={config}
        onCancel={mockOnCancel}
        onHardDelete={mockOnHardDelete}
        onMetadataEdit={mockOnMetadataEdit}
      />,
    );
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('document.metadata.title')).toBeInTheDocument();
    });
  });

  it('คลิก cancel action → เรียก onCancel', async () => {
    mockHasPermission.mockImplementation((perm: string) => perm === 'document.cancel');
    const user = userEvent.setup();
    render(
      <DocumentRowActions
        config={config}
        onCancel={mockOnCancel}
        onHardDelete={mockOnHardDelete}
        onMetadataEdit={mockOnMetadataEdit}
      />,
    );
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('document.cancel.title')).toBeInTheDocument();
    });
    await user.click(screen.getByText('document.cancel.title'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('คลิก hard-delete action → เรียก onHardDelete', async () => {
    mockHasPermission.mockImplementation((perm: string) => perm === 'system.manage_all');
    const user = userEvent.setup();
    render(
      <DocumentRowActions
        config={config}
        onCancel={mockOnCancel}
        onHardDelete={mockOnHardDelete}
        onMetadataEdit={mockOnMetadataEdit}
      />,
    );
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('document.hardDelete.title')).toBeInTheDocument();
    });
    await user.click(screen.getByText('document.hardDelete.title'));
    expect(mockOnHardDelete).toHaveBeenCalled();
  });

  it('คลิก metadata edit action → เรียก onMetadataEdit', async () => {
    mockHasPermission.mockImplementation(
      (perm: string) => perm === '/api/v1/correspondences.edit_metadata',
    );
    const user = userEvent.setup();
    render(
      <DocumentRowActions
        config={config}
        onCancel={mockOnCancel}
        onHardDelete={mockOnHardDelete}
        onMetadataEdit={mockOnMetadataEdit}
      />,
    );
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('document.metadata.title')).toBeInTheDocument();
    });
    await user.click(screen.getByText('document.metadata.title'));
    expect(mockOnMetadataEdit).toHaveBeenCalled();
  });
});
