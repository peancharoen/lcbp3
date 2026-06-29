// File: frontend/lib/services/__tests__/transmittal.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - unit tests for transmittalService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import { transmittalService } from '../transmittal.service';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('transmittalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('ควรดึงรายการ Transmittal ทั้งหมดพร้อม params', async () => {
      const mockResponse = { data: [{ publicId: 'uuid-1', transmittalNumber: 'TR-001' }] };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const searchParams = { search: 'TR' };
      const result = await transmittalService.getAll(searchParams);
      expect(apiClient.get).toHaveBeenCalledWith('/transmittals', { params: searchParams });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getByUuid', () => {
    it('ควรดึงรายละเอียด Transmittal ตาม uuid', async () => {
      const mockResponse = { data: { publicId: 'uuid-1', transmittalNumber: 'TR-001' } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await transmittalService.getByUuid('uuid-1');
      expect(apiClient.get).toHaveBeenCalledWith('/transmittals/uuid-1');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('create', () => {
    it('ควรสร้าง Transmittal ใหม่', async () => {
      const mockResponse = { data: { publicId: 'uuid-1', transmittalNumber: 'TR-001' } };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      const createDto = {
        projectId: 'uuid-proj',
        subject: 'Test Transmittal',
      };
      const result = await transmittalService.create(createDto as any);
      expect(apiClient.post).toHaveBeenCalledWith('/transmittals', createDto);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('update', () => {
    it('ควรแก้ไขข้อมูล Transmittal', async () => {
      const mockResponse = { data: { publicId: 'uuid-1', subject: 'Updated Transmittal' } };
      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);
      const updateDto = { subject: 'Updated Transmittal' };
      const result = await transmittalService.update('uuid-1', updateDto);
      expect(apiClient.put).toHaveBeenCalledWith('/transmittals/uuid-1', updateDto);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('submit', () => {
    it('ควรส่ง Transmittal เข้า workflow และคืนค่าผลลัพธ์', async () => {
      const mockResponse = { data: { data: { instanceId: 'inst-1', currentState: 'SUBMITTED' } } };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      const result = await transmittalService.submit('uuid-1');
      expect(apiClient.post).toHaveBeenCalledWith('/transmittals/uuid-1/submit');
      expect(result).toEqual(mockResponse.data.data);
    });

    it('ควรส่ง Transmittal เข้า workflow และจัดการ fallback เมื่อไม่มี data property ใน response', async () => {
      const mockResponse = { data: { instanceId: 'inst-2', currentState: 'APPROVED' } };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      const result = await transmittalService.submit('uuid-2');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('delete', () => {
    it('ควรลบ Transmittal (Soft Delete)', async () => {
      const mockResponse = { data: { success: true } };
      vi.mocked(apiClient.delete).mockResolvedValue(mockResponse);
      const result = await transmittalService.delete('uuid-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/transmittals/uuid-1');
      expect(result).toEqual(mockResponse.data);
    });
  });
});
