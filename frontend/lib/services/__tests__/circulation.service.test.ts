// File: frontend/lib/services/__tests__/circulation.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - unit tests for circulationService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import { circulationService } from '../circulation.service';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('circulationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('ควรดึงรายการ Circulation ทั้งหมดพร้อม params', async () => {
      const mockResponse = { data: [{ publicId: 'uuid-1', subject: 'Circulation A' }] };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const searchParams = { search: 'Circ' };
      const result = await circulationService.getAll(searchParams);
      expect(apiClient.get).toHaveBeenCalledWith('/circulations', { params: searchParams });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getByUuid', () => {
    it('ควรดึงรายละเอียด Circulation ตาม uuid', async () => {
      const mockResponse = { data: { publicId: 'uuid-1', subject: 'Circulation A' } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await circulationService.getByUuid('uuid-1');
      expect(apiClient.get).toHaveBeenCalledWith('/circulations/uuid-1');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('create', () => {
    it('ควรสร้าง Circulation ใหม่', async () => {
      const mockResponse = { data: { publicId: 'uuid-1', subject: 'Circulation A' } };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      const createDto = {
        correspondenceId: 'uuid-corr',
        recipientUserIds: ['uuid-user'],
      };
      const result = await circulationService.create(createDto as any);
      expect(apiClient.post).toHaveBeenCalledWith('/circulations', createDto);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('updateRouting', () => {
    it('ควรปรับปรุงข้อมูลการ Routing', async () => {
      const mockResponse = { data: { success: true } };
      vi.mocked(apiClient.patch).mockResolvedValue(mockResponse);
      const routingDto = { action: 'ACKNOWLEDGE', comments: 'Seen.' };
      const result = await circulationService.updateRouting('uuid-1', routingDto as any);
      expect(apiClient.patch).toHaveBeenCalledWith('/circulations/uuid-1/routing', routingDto);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getByCorrespondenceUuid', () => {
    it('ควรดึงรายการ Circulation โดยอิงตาม correspondence uuid', async () => {
      const mockResponse = { data: [{ publicId: 'uuid-1', subject: 'Circulation A' }] };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await circulationService.getByCorrespondenceUuid('uuid-corr-1');
      expect(apiClient.get).toHaveBeenCalledWith('/circulations', {
        params: { correspondencePublicId: 'uuid-corr-1', limit: 50 },
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('delete', () => {
    it('ควรลบ Circulation', async () => {
      const mockResponse = { data: { success: true } };
      vi.mocked(apiClient.delete).mockResolvedValue(mockResponse);
      const result = await circulationService.delete('uuid-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/circulations/uuid-1');
      expect(result).toEqual(mockResponse.data);
    });
  });
});
