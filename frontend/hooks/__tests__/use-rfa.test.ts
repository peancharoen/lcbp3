import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useRFAs,
  useRFA,
  useCreateRFA,
  useUpdateRFA,
  useProcessRFA,
  rfaKeys,
} from '../use-rfa';
import { rfaService } from '@/lib/services/rfa.service';
import { toast } from 'sonner';

// Mock service
vi.mock('@/lib/services/rfa.service', () => ({
  rfaService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    processWorkflow: vi.fn(),
  },
}));

describe('use-rfa hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rfaKeys', () => {
    it('should generate correct cache keys', () => {
      expect(rfaKeys.all).toEqual(['rfas']);
      expect(rfaKeys.lists()).toEqual(['rfas', 'list']);
      expect(rfaKeys.list({ projectId: 1 })).toEqual(['rfas', 'list', { projectId: 1 }]);
      expect(rfaKeys.details()).toEqual(['rfas', 'detail']);
      expect(rfaKeys.detail(1)).toEqual(['rfas', 'detail', 1]);
    });
  });

  describe('useRFAs', () => {
    it('should fetch RFAs successfully', async () => {
      const mockData = {
        data: [
          { id: 1, rfaNumber: 'RFA-001' },
          { id: 2, rfaNumber: 'RFA-002' },
        ],
        meta: { total: 2, page: 1, limit: 10 },
      };

      vi.mocked(rfaService.getAll).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRFAs({ projectId: 1 }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(rfaService.getAll).toHaveBeenCalledWith({ projectId: 1 });
    });

    it('should handle error state', async () => {
      vi.mocked(rfaService.getAll).mockRejectedValue(new Error('API Error'));

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRFAs({ projectId: 1 }), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useRFA', () => {
    it('should fetch single RFA by id', async () => {
      const mockData = { id: 1, rfaNumber: 'RFA-001', status: 'pending' };
      vi.mocked(rfaService.getById).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRFA(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(rfaService.getById).toHaveBeenCalledWith(1);
    });

    it('should not fetch when id is falsy', () => {
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRFA(0), { wrapper });

      expect(result.current.isFetching).toBe(false);
      expect(rfaService.getById).not.toHaveBeenCalled();
    });
  });

  describe('useCreateRFA', () => {
    it('should create RFA and show success toast', async () => {
      const mockResponse = { id: 1, rfaNumber: 'RFA-001' };
      vi.mocked(rfaService.create).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateRFA(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          projectId: 1,
          subject: 'Test RFA',
          rfaTypeId: 1,
          toOrganizationId: 1
        });
      });

      expect(rfaService.create).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('RFA created successfully');
    });

    it('should show error toast on failure', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Validation failed' } },
      };
      vi.mocked(rfaService.create).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateRFA(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            projectId: 1,
            subject: '',
            rfaTypeId: 1,
            toOrganizationId: 1
          });
        } catch {
          // Expected
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to create RFA', {
        description: 'Validation failed',
      });
    });
  });

  describe('useUpdateRFA', () => {
    it('should update RFA and invalidate cache', async () => {
      const mockResponse = { id: 1, subject: 'Updated RFA' };
      vi.mocked(rfaService.update).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateRFA(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 1,
          data: { subject: 'Updated RFA' },
        });
      });

      expect(rfaService.update).toHaveBeenCalledWith(1, { subject: 'Updated RFA' });
      expect(toast.success).toHaveBeenCalledWith('RFA updated successfully');
    });
  });

  describe('useProcessRFA', () => {
    it('should process workflow action and show toast', async () => {
      const mockResponse = { id: 1, status: 'approved' };
      vi.mocked(rfaService.processWorkflow).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useProcessRFA(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 1,
          data: { action: 'APPROVE', comments: 'Approved' },
        });
      });

      expect(rfaService.processWorkflow).toHaveBeenCalledWith(1, {
        action: 'APPROVE',
        comments: 'Approved',
      });
      expect(toast.success).toHaveBeenCalledWith('Workflow status updated successfully');
    });

    it('should handle workflow error', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Permission denied' } },
      };
      vi.mocked(rfaService.processWorkflow).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useProcessRFA(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            id: 1,
            data: { action: 'REJECT' },
          });
        } catch {
          // Expected
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to process workflow', {
        description: 'Permission denied',
      });
    });
  });
});
