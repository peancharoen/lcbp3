// File: frontend/lib/services/__tests__/document-numbering.service.test.ts
// Change Log:
// - 2026-06-13: Refactor to use static imports instead of require, fixing ESM module resolution errors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { documentNumberingService } from '../document-numbering.service';
import apiClient from '@/lib/api/client';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('documentNumberingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Admin Dashboard Metrics', () => {
    it('should get metrics', async () => {
      const mockMetrics = {
        totalNumbers: 100,
        activeReservations: 5,
        recentActivity: [],
      };
      (apiClient.get as any).mockResolvedValue({ data: mockMetrics });
      const result = await documentNumberingService.getMetrics();
      expect(result).toEqual(mockMetrics);
      expect(apiClient.get).toHaveBeenCalledWith('/admin/document-numbering/metrics');
    });
  });

  describe('Admin Tools', () => {
    it('should perform manual override', async () => {
      const mockDto = {
        documentNumber: 'DOC-001',
        newSequence: 100,
        reason: 'Manual override',
      };
      (apiClient.post as any).mockResolvedValue({ data: { success: true } });
      await documentNumberingService.manualOverride(mockDto);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/admin/document-numbering/manual-override',
        mockDto
      );
    });

    it('should void and replace number', async () => {
      const mockDto = {
        documentNumber: 'DOC-001',
        reason: 'Void',
        replace: true,
      };
      const mockResponse = { documentNumber: 'DOC-002' };
      (apiClient.post as any).mockResolvedValue({ data: mockResponse });
      const result = await documentNumberingService.voidAndReplace(mockDto);
      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/admin/document-numbering/void-and-replace',
        mockDto
      );
    });

    it('should cancel number', async () => {
      const mockDto = {
        documentNumber: 'DOC-001',
        reason: 'Cancel',
        projectId: 1,
      };
      (apiClient.post as any).mockResolvedValue({ data: { success: true } });
      await documentNumberingService.cancelNumber(mockDto);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/admin/document-numbering/cancel',
        mockDto
      );
    });

    it('should bulk import with FormData', async () => {
      const mockFormData = new FormData();
      mockFormData.append('file', new Blob(['test']), 'test.csv');
      const mockResponse = { imported: 10, errors: [] };
      (apiClient.post as any).mockResolvedValue({ data: mockResponse });
      const result = await documentNumberingService.bulkImport(mockFormData);
      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/admin/document-numbering/bulk-import',
        mockFormData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
    });

    it('should bulk import with array data', async () => {
      const mockData = [
        { documentNumber: 'DOC-001', projectId: 1, sequenceNumber: 1 },
        { documentNumber: 'DOC-002', projectId: 1, sequenceNumber: 2 },
      ];
      const mockResponse = { imported: 2, errors: [] };
      (apiClient.post as any).mockResolvedValue({ data: mockResponse });
      const result = await documentNumberingService.bulkImport(mockData);
      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/admin/document-numbering/bulk-import',
        mockData,
        {}
      );
    });
  });

  describe('Audit Logs', () => {
    it('should get audit logs (currently returns empty)', async () => {
      const result = await documentNumberingService.getAuditLogs();
      expect(result).toEqual([]);
    });
  });
});
