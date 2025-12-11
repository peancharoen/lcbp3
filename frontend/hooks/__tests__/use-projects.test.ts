import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  projectKeys,
} from '../use-projects';
import { projectService } from '@/lib/services/project.service';
import { toast } from 'sonner';

// Mock the service
vi.mock('@/lib/services/project.service', () => ({
  projectService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('use-projects hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('projectKeys', () => {
    it('should generate correct cache keys', () => {
      expect(projectKeys.all).toEqual(['projects']);
      expect(projectKeys.list({ search: 'test' })).toEqual([
        'projects',
        'list',
        { search: 'test' },
      ]);
      expect(projectKeys.detail(1)).toEqual(['projects', 'detail', 1]);
    });
  });

  describe('useProjects', () => {
    it('should fetch projects successfully', async () => {
      const mockData = [
        { id: 1, name: 'Project Alpha', code: 'P-001' },
        { id: 2, name: 'Project Beta', code: 'P-002' },
      ];

      vi.mocked(projectService.getAll).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useProjects({ search: 'test' }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(projectService.getAll).toHaveBeenCalledWith({ search: 'test' });
    });

    it('should fetch projects without params', async () => {
      const mockData = [{ id: 1, name: 'Project Alpha' }];
      vi.mocked(projectService.getAll).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(projectService.getAll).toHaveBeenCalledWith(undefined);
    });

    it('should handle error state', async () => {
      vi.mocked(projectService.getAll).mockRejectedValue(new Error('API Error'));

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useProjects({}), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useCreateProject', () => {
    it('should create project and show success toast', async () => {
      const mockResponse = { id: 1, name: 'New Project' };
      vi.mocked(projectService.create).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateProject(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          name: 'New Project',
          code: 'P-003',
          contractId: 1,
        });
      });

      expect(projectService.create).toHaveBeenCalledWith({
        name: 'New Project',
        code: 'P-003',
        contractId: 1,
      });
      expect(toast.success).toHaveBeenCalledWith('Project created successfully');
    });

    it('should show error toast on failure', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Duplicate code' } },
      };
      vi.mocked(projectService.create).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateProject(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            name: 'Test',
            code: 'P-001',
          });
        } catch {
          // Expected
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to create project', {
        description: 'Duplicate code',
      });
    });
  });

  describe('useUpdateProject', () => {
    it('should update project and show success toast', async () => {
      const mockResponse = { id: 1, name: 'Updated Project' };
      vi.mocked(projectService.update).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateProject(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 1,
          data: { name: 'Updated Project' },
        });
      });

      expect(projectService.update).toHaveBeenCalledWith(1, { name: 'Updated Project' });
      expect(toast.success).toHaveBeenCalledWith('Project updated successfully');
    });

    it('should show error toast on failure', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Not found' } },
      };
      vi.mocked(projectService.update).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateProject(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            id: 999,
            data: { name: 'Test' },
          });
        } catch {
          // Expected
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update project', {
        description: 'Not found',
      });
    });
  });

  describe('useDeleteProject', () => {
    it('should delete project and show success toast', async () => {
      vi.mocked(projectService.delete).mockResolvedValue({});

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDeleteProject(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync(1);
      });

      expect(projectService.delete).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith('Project deleted successfully');
    });

    it('should show error toast on delete failure', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Cannot delete' } },
      };
      vi.mocked(projectService.delete).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDeleteProject(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync(1);
        } catch {
          // Expected
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to delete project', {
        description: 'Cannot delete',
      });
    });
  });
});
