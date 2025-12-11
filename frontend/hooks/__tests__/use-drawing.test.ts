import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useDrawings,
  useDrawing,
  useCreateDrawing,
  drawingKeys,
} from '../use-drawing';
import { contractDrawingService } from '@/lib/services/contract-drawing.service';
import { shopDrawingService } from '@/lib/services/shop-drawing.service';
import { toast } from 'sonner';

// Mock services
vi.mock('@/lib/services/contract-drawing.service', () => ({
  contractDrawingService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/services/shop-drawing.service', () => ({
  shopDrawingService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
  },
}));

describe('use-drawing hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('drawingKeys', () => {
    it('should generate correct cache keys', () => {
      expect(drawingKeys.all).toEqual(['drawings']);
      expect(drawingKeys.lists()).toEqual(['drawings', 'list']);
      expect(drawingKeys.list('CONTRACT', { projectId: 1 })).toEqual([
        'drawings',
        'list',
        'CONTRACT',
        { projectId: 1 },
      ]);
      expect(drawingKeys.detail('SHOP', 1)).toEqual(['drawings', 'detail', 'SHOP', 1]);
    });
  });

  describe('useDrawings', () => {
    it('should fetch CONTRACT drawings successfully', async () => {
      const mockData = {
        data: [
          { id: 1, drawingNumber: 'CD-001' },
          { id: 2, drawingNumber: 'CD-002' },
        ],
        meta: { total: 2, page: 1, limit: 10 },
      };

      vi.mocked(contractDrawingService.getAll).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDrawings('CONTRACT', { projectId: 1 }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(contractDrawingService.getAll).toHaveBeenCalledWith({ projectId: 1 });
      expect(shopDrawingService.getAll).not.toHaveBeenCalled();
    });

    it('should fetch SHOP drawings successfully', async () => {
      const mockData = {
        data: [{ id: 1, drawingNumber: 'SD-001' }],
        meta: { total: 1, page: 1, limit: 10 },
      };

      vi.mocked(shopDrawingService.getAll).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDrawings('SHOP', { projectId: 1 }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(shopDrawingService.getAll).toHaveBeenCalledWith({ projectId: 1 });
      expect(contractDrawingService.getAll).not.toHaveBeenCalled();
    });

    it('should handle error state', async () => {
      const mockError = new Error('API Error');
      vi.mocked(contractDrawingService.getAll).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDrawings('CONTRACT', { projectId: 1 }), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useDrawing', () => {
    it('should fetch single CONTRACT drawing by id', async () => {
      const mockData = { id: 1, drawingNumber: 'CD-001' };
      vi.mocked(contractDrawingService.getById).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDrawing('CONTRACT', 1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(contractDrawingService.getById).toHaveBeenCalledWith(1);
    });

    it('should fetch single SHOP drawing by id', async () => {
      const mockData = { id: 1, drawingNumber: 'SD-001' };
      vi.mocked(shopDrawingService.getById).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDrawing('SHOP', 1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(shopDrawingService.getById).toHaveBeenCalledWith(1);
    });

    it('should not fetch when id is falsy', () => {
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDrawing('CONTRACT', 0), { wrapper });

      expect(result.current.isFetching).toBe(false);
      expect(contractDrawingService.getById).not.toHaveBeenCalled();
    });
  });

  describe('useCreateDrawing', () => {
    it('should create CONTRACT drawing and show success toast', async () => {
      const mockResponse = { id: 1, drawingNumber: 'CD-001' };
      vi.mocked(contractDrawingService.create).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateDrawing('CONTRACT'), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          projectId: 1,
          drawingNumber: 'CD-001',
          title: 'Test Drawing',
        });
      });

      expect(contractDrawingService.create).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Contract Drawing uploaded successfully');
    });

    it('should create SHOP drawing and show success toast', async () => {
      const mockResponse = { id: 1, drawingNumber: 'SD-001' };
      vi.mocked(shopDrawingService.create).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateDrawing('SHOP'), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          contractDrawingId: 1,
          title: 'Shop Drawing',
        });
      });

      expect(shopDrawingService.create).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Shop Drawing uploaded successfully');
    });

    it('should show error toast on failure', async () => {
      const mockError = {
        message: 'API Error',
        response: { data: { message: 'File too large' } },
      };
      vi.mocked(contractDrawingService.create).mockRejectedValue(mockError);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateDrawing('CONTRACT'), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            projectId: 1,
            drawingNumber: 'CD-001',
            title: 'Test',
          });
        } catch {
          // Expected to throw
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to upload drawing', {
        description: 'File too large',
      });
    });
  });
});
