// File: frontend/components/admin/security/__tests__/rbac-matrix.test.tsx
// Change Log
// - 2026-06-13: Add coverage for RBAC matrix load, toggle, and save behavior.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { createTestQueryClient } from '@/lib/test-utils';
import { RbacMatrix } from '../rbac-matrix';

const roles = [
  {
    publicId: '019505a1-7c3e-7000-8000-abc123def601',
    roleId: 10,
    roleName: 'Admin',
    permissions: [{ permissionId: 1, permissionName: 'system.view', description: 'View system' }],
  },
  {
    publicId: '019505a1-7c3e-7000-8000-abc123def602',
    roleId: 20,
    roleName: 'Viewer',
    permissions: [],
  },
];

const permissions = [
  { permissionId: 1, permissionName: 'system.view', description: 'View system' },
  { permissionId: 2, permissionName: 'system.manage', description: 'Manage system' },
];

function renderWithQueryClient() {
  const { wrapper } = createTestQueryClient();
  return render(<RbacMatrix />, { wrapper });
}

describe('RbacMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/users/roles') return Promise.resolve({ data: { data: roles } });
      if (url === '/users/permissions') return Promise.resolve({ data: { data: permissions } });
      return Promise.resolve({ data: [] });
    });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { success: true } });
  });

  it('renders roles and permissions from API data', async () => {
    renderWithQueryClient();
    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
    expect(screen.getByText('system.manage')).toBeInTheDocument();
  });

  it('saves pending permission changes', async () => {
    const user = userEvent.setup();
    renderWithQueryClient();
    await screen.findByText('system.manage');
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[3]);
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/users/roles/20/permissions', { permissionIds: [2] });
    });
    expect(toast.success).toHaveBeenCalledWith('Permissions updated successfully');
  });

  it('renders empty matrix safely when API response is malformed', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { data: null } } });
    renderWithQueryClient();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    });
  });
});
