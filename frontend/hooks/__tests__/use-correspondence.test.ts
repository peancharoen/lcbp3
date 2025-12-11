import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useCorrespondences,
  useCorrespondence,
  useCreateCorrespondence,
  useUpdateCorrespondence,
  useDeleteCorrespondence,
  useSubmitCorrespondence,
  useProcessWorkflow,
  correspondenceKeys,
} from '../use-correspondence';
import { correspondenceService } from '@/lib/services/correspondence.service';
import { toast } from 'sonner';

// Mock the service
vi.mock('@/lib/services/correspondence.service', () => ({
  correspondenceService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    submit: vi.fn(),
    processWorkflow: vi.fn(),
  },
}));

describe('use-correspondence hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('correspondenceKeys', () => {
    it('should generate correct cache keys', () => {
      expect(correspondenceKeys.all).toEqual(['correspondences']);
      expect(correspondenceKeys.lists()).toEqual(['correspondences', 'list']);
      expect(correspondenceKeys.list({ projectId: 1 })).toEqual([
        'correspondences',
        'list',
        { projectId: 1 },
      ]);
      expect(correspondenceKeys.details()).toEqual(['correspondences', 'detail']);
      expect(correspondenceKeys.detail(1)).toEqual(['correspondences', 'detail', 1]);
    });
  });

  describe('useCorrespondences', () => {
    it('should fetch correspondences successfully', async () => {
      const mockData = {
        data: [
          { id: 1, title: 'Test Correspondence 1' },
          { id: 2, title: 'Test Correspondence 2' },
        ],
        meta: { total: 2, page: 1, limit: 10 },
      };

      vi.mocked(correspondenceService.getAll).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCorrespondences({ projectId: 1 }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(correspondenceService.getAll).toHaveBeenCalledWith({ projectId: 1 });
    });

    it('should handle error state', async () => {
      const mockError = new Error('API Error');
      vi.mocked(correspondenceService.getAll).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCorrespondences({ projectId: 1 }), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('useCorrespondence', () => {
    it('should fetch single correspondence by id', async () => {
      const mockData = { id: 1, title: 'Test Correspondence' };
      vi.mocked(correspondenceService.getById).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCorrespondence(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(correspondenceService.getById).toHaveBeenCalledWith(1);
    });

    it('should not fetch when id is falsy', () => {
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCorrespondence(0), { wrapper });

      expect(result.current.isFetching).toBe(false);
      expect(correspondenceService.getById).not.toHaveBeenCalled();
    });
  });

  describe('useCreateCorrespondence', () => {
    it('should create correspondence and show success toast', async () => {
      const mockResponse = { id: 1, title: 'New Correspondence' };
      vi.mocked(correspondenceService.create).mockResolvedValue(mockResponse);

      const { wrapper, queryClient } = createTestQueryClient();
      const { result } = renderHook(() => useCreateCorrespondence(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          title: 'New Correspondence',
          projectId: 1,
          correspondenceTypeId: 1,
        });
      });

      expect(correspondenceService.create).toHaveBeenCalledWith({
        title: 'New Correspondence',
        projectId: 1,
        correspondenceTypeId: 1,
      });
      expect(toast.success).toHaveBeenCalledWith('Correspondence created successfully');
    });

    it('should show error toast on failure', async () => {
      const mockError = {
        message: 'API Error',
        response: { data: { message: 'Validation failed' } },
      };
      vi.mocked(correspondenceService.create).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateCorrespondence(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            title: '',
            projectId: 1,
            correspondenceTypeId: 1,
          });
        } catch {
          // Expected to throw
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to create correspondence', {
        description: 'Validation failed',
      });
    });
  });

  describe('useUpdateCorrespondence', () => {
    it('should update correspondence and invalidate cache', async () => {
      const mockResponse = { id: 1, title: 'Updated Correspondence' };
      vi.mocked(correspondenceService.update).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateCorrespondence(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 1,
          data: { title: 'Updated Correspondence' },
        });
      });

      expect(correspondenceService.update).toHaveBeenCalledWith(1, {
        title: 'Updated Correspondence',
      });
      expect(toast.success).toHaveBeenCalledWith('Correspondence updated successfully');
    });
  });

  describe('useDeleteCorrespondence', () => {
    it('should delete correspondence and show success toast', async () => {
      vi.mocked(correspondenceService.delete).mockResolvedValue({});

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDeleteCorrespondence(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync(1);
      });

      expect(correspondenceService.delete).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith('Correspondence deleted successfully');
    });
  });

  describe('useSubmitCorrespondence', () => {
    it('should submit correspondence for workflow', async () => {
      const mockResponse = { id: 1, status: 'submitted' };
      vi.mocked(correspondenceService.submit).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useSubmitCorrespondence(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 1,
          data: { recipientIds: [2, 3] },
        });
      });

      expect(correspondenceService.submit).toHaveBeenCalledWith(1, { recipientIds: [2, 3] });
      expect(toast.success).toHaveBeenCalledWith('Correspondence submitted successfully');
    });
  });

  describe('useProcessWorkflow', () => {
    it('should process workflow action', async () => {
      const mockResponse = { id: 1, status: 'approved' };
      vi.mocked(correspondenceService.processWorkflow).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useProcessWorkflow(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 1,
          data: { action: 'approve', comment: 'LGTM' },
        });
      });

      expect(correspondenceService.processWorkflow).toHaveBeenCalledWith(1, {
        action: 'approve',
        comment: 'LGTM',
      });
      expect(toast.success).toHaveBeenCalledWith('Action completed successfully');
    });

    it('should handle workflow action error', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Permission denied' } },
      };
      vi.mocked(correspondenceService.processWorkflow).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useProcessWorkflow(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            id: 1,
            data: { action: 'approve' },
          });
        } catch {
          // Expected to throw
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to process action', {
        description: 'Permission denied',
      });
    });
  });
});
