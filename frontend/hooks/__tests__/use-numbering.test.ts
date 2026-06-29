// File: frontend/hooks/__tests__/use-numbering.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for use-numbering hooks

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useTemplates,
  useSaveTemplate,
  useNumberingMetrics,
  useNumberingAuditLogs,
  useManualOverrideNumbering,
  useVoidAndReplaceNumbering,
  useCancelNumbering,
  useBulkImportNumbering,
  numberingKeys,
} from '../use-numbering';
import { documentNumberingService } from '@/lib/services/document-numbering.service';
import { numberingApi } from '@/lib/api/numbering';

// Mock services
vi.mock('@/lib/services/document-numbering.service', () => ({
  documentNumberingService: {
    getMetrics: vi.fn(),
    getAuditLogs: vi.fn(),
    manualOverride: vi.fn(),
    voidAndReplace: vi.fn(),
    cancelNumber: vi.fn(),
    bulkImport: vi.fn(),
  },
}));

vi.mock('@/lib/api/numbering', () => ({
  numberingApi: {
    getTemplates: vi.fn(),
    saveTemplate: vi.fn(),
  },
}));

describe('use-numbering hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('numberingKeys', () => {
    it('ควรสร้าง cache keys ที่ถูกต้อง', () => {
      expect(numberingKeys.all).toEqual(['numbering']);
      expect(numberingKeys.templates()).toEqual(['numbering', 'templates']);
      expect(numberingKeys.metrics()).toEqual(['numbering', 'metrics']);
      expect(numberingKeys.auditLogs({ page: 1 })).toEqual(['numbering', 'auditLogs', { page: 1 }]);
    });
  });

  describe('useTemplates', () => {
    it('ควรดึงข้อมูล templates สำเร็จ', async () => {
      const mockData = [{ id: 1, templateName: 'Temp A' }];
      vi.mocked(numberingApi.getTemplates).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useTemplates(), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(numberingApi.getTemplates).toHaveBeenCalled();
    });
  });

  describe('useSaveTemplate', () => {
    it('ควรบันทึก template สำเร็จ', async () => {
      const mockResponse = { id: 1, success: true };
      vi.mocked(numberingApi.saveTemplate).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useSaveTemplate(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ templateName: 'New Temp' } as any);
      });
      expect(numberingApi.saveTemplate).toHaveBeenCalledWith({ templateName: 'New Temp' });
    });
  });

  describe('useNumberingMetrics', () => {
    it('ควรดึงข้อมูล metrics สำเร็จ', async () => {
      const mockData = { totalGenerated: 100 };
      vi.mocked(documentNumberingService.getMetrics).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useNumberingMetrics(), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(documentNumberingService.getMetrics).toHaveBeenCalled();
    });
  });

  describe('useNumberingAuditLogs', () => {
    it('ควรดึงข้อมูล audit logs สำเร็จ', async () => {
      const mockData = [{ id: 1, action: 'OVERRIDE' }];
      vi.mocked(documentNumberingService.getAuditLogs).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useNumberingAuditLogs({ page: 1 }), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(documentNumberingService.getAuditLogs).toHaveBeenCalled();
    });
  });

  describe('useManualOverrideNumbering', () => {
    it('ควรทำ manual override สำเร็จ', async () => {
      const mockResponse = { success: true };
      vi.mocked(documentNumberingService.manualOverride).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useManualOverrideNumbering(), { wrapper });
      const mockDto = { documentNumber: 'DOC-001', reason: 'Urgent' };
      await act(async () => {
        await result.current.mutateAsync(mockDto as any);
      });
      expect(documentNumberingService.manualOverride).toHaveBeenCalledWith(mockDto);
    });
  });

  describe('useVoidAndReplaceNumbering', () => {
    it('ควรทำ void and replace สำเร็จ', async () => {
      const mockResponse = { success: true };
      vi.mocked(documentNumberingService.voidAndReplace).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useVoidAndReplaceNumbering(), { wrapper });
      const mockDto = { originalNumber: 'DOC-001', newNumber: 'DOC-002' };
      await act(async () => {
        await result.current.mutateAsync(mockDto as any);
      });
      expect(documentNumberingService.voidAndReplace).toHaveBeenCalledWith(mockDto);
    });
  });

  describe('useCancelNumbering', () => {
    it('ควรทำ cancel numbering สำเร็จ', async () => {
      const mockResponse = { success: true };
      vi.mocked(documentNumberingService.cancelNumber).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCancelNumbering(), { wrapper });
      const mockDto = { documentNumber: 'DOC-001' };
      await act(async () => {
        await result.current.mutateAsync(mockDto as any);
      });
      expect(documentNumberingService.cancelNumber).toHaveBeenCalledWith(mockDto);
    });
  });

  describe('useBulkImportNumbering', () => {
    it('ควรทำ bulk import สำเร็จ', async () => {
      const mockResponse = { success: true };
      vi.mocked(documentNumberingService.bulkImport).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useBulkImportNumbering(), { wrapper });
      const mockDto = [{ documentNumber: 'DOC-001', projectId: 1, sequenceNumber: 1 }];
      await act(async () => {
        await result.current.mutateAsync(mockDto);
      });
      expect(documentNumberingService.bulkImport).toHaveBeenCalledWith(mockDto);
    });
  });
});
