// File: frontend/components/admin/__tests__/user-dialog.test.tsx
// Change Log
// - 2026-06-13: Add coverage for admin user dialog create and edit flows.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDialog } from '../user-dialog';
import { useCreateUser, useRoles, useUpdateUser } from '@/hooks/use-users';
import { useOrganizations } from '@/hooks/use-master-data';
import type { User } from '@/types/user';

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('@/hooks/use-users', () => ({
  useCreateUser: vi.fn(),
  useUpdateUser: vi.fn(),
  useRoles: vi.fn(),
}));

vi.mock('@/hooks/use-master-data', () => ({
  useOrganizations: vi.fn(),
}));

const existingUser: User = {
  publicId: '019505a1-7c3e-7000-8000-abc123defb01',
  username: 'existing',
  email: 'existing@example.com',
  firstName: 'Existing',
  lastName: 'User',
  isActive: true,
  lineId: 'line-existing',
  primaryOrganizationId: '019505a1-7c3e-7000-8000-abc123defb02',
  roles: [
    {
      publicId: '019505a1-7c3e-7000-8000-abc123defb03',
      roleId: 2,
      roleName: 'Reviewer',
      description: 'Reviews documents',
    },
  ],
  failedAttempts: 0,
};

function input(name: string): HTMLInputElement {
  const found = document.body.querySelector(`input[name="${name}"]`);
  if (!(found instanceof HTMLInputElement)) {
    throw new Error(`Input not found: ${name}`);
  }
  return found;
}

describe('UserDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateUser).mockReturnValue({
      mutate: createMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateUser>);
    vi.mocked(useUpdateUser).mockReturnValue({
      mutate: updateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateUser>);
    vi.mocked(useRoles).mockReturnValue({
      data: [
        {
          publicId: '019505a1-7c3e-7000-8000-abc123defb03',
          roleId: 2,
          roleName: 'Reviewer',
          description: 'Reviews documents',
        },
      ],
    } as unknown as ReturnType<typeof useRoles>);
    vi.mocked(useOrganizations).mockReturnValue({
      data: [
        {
          publicId: '019505a1-7c3e-7000-8000-abc123defb02',
          organizationCode: 'TEAM',
          organizationName: 'TEAM Consulting',
        },
      ],
    } as unknown as ReturnType<typeof useOrganizations>);
  });

  it('creates a user with required fields and selected role', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<UserDialog open onOpenChange={onOpenChange} />);
    await user.type(input('username'), 'newuser');
    await user.type(input('email'), 'new@example.com');
    await user.type(input('firstName'), 'New');
    await user.type(input('lastName'), 'User');
    await user.type(input('password'), 'secret1');
    await user.type(input('confirmPassword'), 'secret1');
    await user.click(screen.getByRole('checkbox', { name: /Reviewer/i }));
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          password: 'secret1',
          roleIds: [2],
        }),
        expect.objectContaining({ onSuccess: expect.any(Function) })
      );
    });
  });

  it('pre-fills existing user and submits update without empty password', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<UserDialog open onOpenChange={onOpenChange} user={existingUser} />);
    expect(input('username')).toHaveValue('existing');
    await user.clear(input('firstName'));
    await user.type(input('firstName'), 'Edited');
    await user.click(screen.getByRole('checkbox', { name: 'Active User' }));
    await user.click(screen.getByRole('button', { name: 'Update User' }));
    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith(
        {
          uuid: existingUser.publicId,
          data: expect.objectContaining({
            firstName: 'Edited',
            isActive: false,
          }),
        },
        expect.objectContaining({ onSuccess: expect.any(Function) })
      );
    });
    expect(updateMutate.mock.calls[0][0].data).not.toHaveProperty('password');
  });

  it('closes when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<UserDialog open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
