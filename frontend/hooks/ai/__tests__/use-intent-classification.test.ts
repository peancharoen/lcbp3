// File: hooks/ai/__tests__/use-intent-classification.test.ts
// Change Log
// - 2026-05-19: สร้าง Unit tests สำหรับ Intent Classification hooks (T038).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useIntentDefinitions,
  useIntentDefinition,
  useIntentPatterns,
  useCreateIntentDefinition,
  useClassifyIntent,
} from '../use-intent-classification';
import { aiIntentService } from '@/lib/services/ai-intent.service';

// Mock service
vi.mock('@/lib/services/ai-intent.service', () => ({
  aiIntentService: {
    getDefinitions: vi.fn(),
    getDefinition: vi.fn(),
    getPatterns: vi.fn(),
    createDefinition: vi.fn(),
    updateDefinition: vi.fn(),
    createPattern: vi.fn(),
    updatePattern: vi.fn(),
    deletePattern: vi.fn(),
    classify: vi.fn(),
  },
}));

describe('use-intent-classification hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useIntentDefinitions', () => {
    it('ควรดึง definitions สำเร็จ', async () => {
      const mockData = [
        { publicId: 'uuid-1', intentCode: 'GET_RFA', category: 'read' },
        { publicId: 'uuid-2', intentCode: 'SUMMARIZE_DOCUMENT', category: 'read' },
      ];

      vi.mocked(aiIntentService.getDefinitions).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useIntentDefinitions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(aiIntentService.getDefinitions).toHaveBeenCalledWith(undefined);
    });

    it('ควรส่ง filter params ไปด้วย', async () => {
      vi.mocked(aiIntentService.getDefinitions).mockResolvedValue([]);

      const { wrapper } = createTestQueryClient();
      renderHook(
        () => useIntentDefinitions({ category: 'read', isActive: true }),
        { wrapper },
      );

      await waitFor(() => {
        expect(aiIntentService.getDefinitions).toHaveBeenCalledWith({
          category: 'read',
          isActive: true,
        });
      });
    });
  });

  describe('useIntentDefinition', () => {
    it('ควรดึง definition ตาม intentCode', async () => {
      const mockDef = {
        publicId: 'uuid-1',
        intentCode: 'GET_RFA',
        descriptionTh: 'ดึง RFA',
        descriptionEn: 'Get RFA',
        category: 'read',
        isActive: true,
      };

      vi.mocked(aiIntentService.getDefinition).mockResolvedValue(mockDef);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useIntentDefinition('GET_RFA'),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockDef);
      expect(aiIntentService.getDefinition).toHaveBeenCalledWith('GET_RFA');
    });

    it('ควรไม่ fetch เมื่อ intentCode เป็นค่าว่าง', () => {
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useIntentDefinition(''),
        { wrapper },
      );

      // enabled: !!intentCode → false → ไม่ fetch
      expect(result.current.fetchStatus).toBe('idle');
      expect(aiIntentService.getDefinition).not.toHaveBeenCalled();
    });
  });

  describe('useIntentPatterns', () => {
    it('ควรดึง patterns ตาม intentCode', async () => {
      const mockPatterns = [
        { publicId: 'p-1', intentCode: 'GET_RFA', patternType: 'keyword', patternValue: 'rfa' },
      ];

      vi.mocked(aiIntentService.getPatterns).mockResolvedValue(mockPatterns);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useIntentPatterns('GET_RFA'),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockPatterns);
    });
  });

  describe('useCreateIntentDefinition', () => {
    it('ควรเรียก createDefinition สำเร็จ', async () => {
      const newDef = {
        intentCode: 'TEST_INTENT',
        descriptionTh: 'ทดสอบ',
        descriptionEn: 'Test',
        category: 'utility' as const,
      };

      vi.mocked(aiIntentService.createDefinition).mockResolvedValue({
        publicId: 'new-uuid',
        ...newDef,
        isActive: true,
      });

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useCreateIntentDefinition(),
        { wrapper },
      );

      result.current.mutate(newDef);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(aiIntentService.createDefinition).toHaveBeenCalledWith(newDef);
    });
  });

  describe('useClassifyIntent', () => {
    it('ควร classify query สำเร็จ', async () => {
      const mockResult = {
        intentCode: 'SUMMARIZE_DOCUMENT',
        confidence: 1.0,
        method: 'pattern',
        latencyMs: 3,
      };

      vi.mocked(aiIntentService.classify).mockResolvedValue(mockResult);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useClassifyIntent(),
        { wrapper },
      );

      result.current.mutate({ query: 'สรุปเอกสาร' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResult);
      expect(aiIntentService.classify).toHaveBeenCalledWith('สรุปเอกสาร', undefined);
    });

    it('ควรส่ง projectPublicId ไปด้วย (ถ้ามี)', async () => {
      vi.mocked(aiIntentService.classify).mockResolvedValue({
        intentCode: 'GET_RFA',
        confidence: 0.9,
        method: 'llm_fallback',
        latencyMs: 500,
      });

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useClassifyIntent(),
        { wrapper },
      );

      result.current.mutate({
        query: 'show rfa',
        projectPublicId: 'proj-uuid-123',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(aiIntentService.classify).toHaveBeenCalledWith('show rfa', 'proj-uuid-123');
    });

    it('ควร handle error state', async () => {
      vi.mocked(aiIntentService.classify).mockRejectedValue(new Error('Network error'));

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useClassifyIntent(),
        { wrapper },
      );

      result.current.mutate({ query: 'test' });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });
});
