import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useUsers,
  useRoles,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  userKeys,
} from '../use-users';
import { userService } from '@/lib/services/user.service';
import { toast } from 'sonner';

// Mock the service
vi.mock('@/lib/services/user.service', () => ({
  userService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getRoles: vi.fn(),
  },
}));

describe('use-users hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('userKeys', () => {
    it('should generate correct cache keys', () => {
      expect(userKeys.all).toEqual(['users']);
      expect(userKeys.list({ search: 'john' })).toEqual([
        'users',
        'list',
        { search: 'john' },
      ]);
      expect(userKeys.detail(1)).toEqual(['users', 'detail', 1]);
    });
  });

  describe('useUsers', () => {
    it('should fetch users successfully', async () => {
      const mockData = {
        data: [
          { userId: 1, username: 'john', email: 'john@example.com' },
          { userId: 2, username: 'jane', email: 'jane@example.com' },
        ],
        meta: { total: 2, page: 1, limit: 10 },
      };

      vi.mocked(userService.getAll).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUsers({ search: 'test' }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(userService.getAll).toHaveBeenCalledWith({ search: 'test' });
    });

    it('should handle error state', async () => {
      vi.mocked(userService.getAll).mockRejectedValue(new Error('API Error'));

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUsers(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useRoles', () => {
    it('should fetch roles successfully', async () => {
      const mockRoles = [
        { roleId: 1, name: 'Admin' },
        { roleId: 2, name: 'Editor' },
        { roleId: 3, name: 'Viewer' },
      ];

      vi.mocked(userService.getRoles).mockResolvedValue(mockRoles);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRoles(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockRoles);
      expect(userService.getRoles).toHaveBeenCalled();
    });
  });

  describe('useCreateUser', () => {
    it('should create user and show success toast', async () => {
      const mockResponse = { userId: 1, username: 'newuser' };
      vi.mocked(userService.create).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateUser(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          roleIds: [2],
        });
      });

      expect(userService.create).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('User created successfully');
    });

    it('should show error toast on failure', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Username already exists' } },
      };
      vi.mocked(userService.create).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateUser(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            username: 'existinguser',
            email: 'test@example.com',
            password: 'password',
          });
        } catch {
          // Expected
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to create user', {
        description: 'Username already exists',
      });
    });
  });

  describe('useUpdateUser', () => {
    it('should update user and show success toast', async () => {
      const mockResponse = { userId: 1, email: 'updated@example.com' };
      vi.mocked(userService.update).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateUser(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 1,
          data: { email: 'updated@example.com' },
        });
      });

      expect(userService.update).toHaveBeenCalledWith(1, { email: 'updated@example.com' });
      expect(toast.success).toHaveBeenCalledWith('User updated successfully');
    });

    it('should show error toast on failure', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'User not found' } },
      };
      vi.mocked(userService.update).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateUser(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            id: 999,
            data: { email: 'test@example.com' },
          });
        } catch {
          // Expected
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update user', {
        description: 'User not found',
      });
    });
  });

  describe('useDeleteUser', () => {
    it('should delete user and show success toast', async () => {
      vi.mocked(userService.delete).mockResolvedValue({});

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDeleteUser(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync(1);
      });

      expect(userService.delete).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith('User deleted successfully');
    });

    it('should show error toast on delete failure', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Cannot delete yourself' } },
      };
      vi.mocked(userService.delete).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDeleteUser(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync(1);
        } catch {
          // Expected
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to delete user', {
        description: 'Cannot delete yourself',
      });
    });
  });
});
