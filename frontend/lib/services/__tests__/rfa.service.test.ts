// File: frontend/lib/services/__tests__/rfa.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - unit tests for rfaService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import { rfaService } from '../rfa.service';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('rfaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('ควรดึงรายการ RFA ทั้งหมดพร้อม params', async () => {
      const mockResponse = { data: [{ publicId: 'uuid-1', subject: 'Test RFA' }] };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const searchParams = { search: 'Test' };
      const result = await rfaService.getAll(searchParams);
      expect(apiClient.get).toHaveBeenCalledWith('/rfas', { params: searchParams });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getByUuid', () => {
    it('ควรดึงรายละเอียด RFA ตาม uuid', async () => {
      const mockResponse = { data: { publicId: 'uuid-1', subject: 'Test RFA' } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await rfaService.getByUuid('uuid-1');
      expect(apiClient.get).toHaveBeenCalledWith('/rfas/uuid-1');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('create', () => {
    it('ควรสร้าง RFA ใหม่', async () => {
      const mockResponse = { data: { publicId: 'uuid-1', subject: 'Test RFA' } };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      const createDto = {
        projectId: 'uuid-proj',
        contractId: 'uuid-cont',
        disciplineId: 'uuid-disp',
        rfaTypeId: 'uuid-type',
        subject: 'Test RFA',
        toOrganizationId: 'uuid-org',
      };
      const result = await rfaService.create(createDto as any);
      expect(apiClient.post).toHaveBeenCalledWith('/rfas', createDto);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('submit', () => {
    it('ควรส่ง RFA เข้า workflow', async () => {
      const mockResponse = { data: { publicId: 'uuid-1', status: 'SUBMITTED' } };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      const submitDto = { reviewTeamPublicId: 'uuid-team' };
      const result = await rfaService.submit('uuid-1', submitDto);
      expect(apiClient.post).toHaveBeenCalledWith('/rfas/uuid-1/submit', submitDto);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('update', () => {
    it('ควรแก้ไขข้อมูล RFA', async () => {
      const mockResponse = { data: { publicId: 'uuid-1', subject: 'Updated RFA' } };
      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);
      const updateDto = { subject: 'Updated RFA' };
      const result = await rfaService.update('uuid-1', updateDto);
      expect(apiClient.put).toHaveBeenCalledWith('/rfas/uuid-1', updateDto);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('processWorkflow', () => {
    it('ควรดำเนินการขั้นตอนอนุมัติ (Workflow Action)', async () => {
      const mockResponse = { data: { status: 'APPROVED' } };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      const actionDto = { action: 'APPROVE', comments: 'Approved!' };
      const result = await rfaService.processWorkflow('uuid-1', actionDto as any);
      expect(apiClient.post).toHaveBeenCalledWith('/rfas/uuid-1/action', actionDto);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('delete', () => {
    it('ควรลบ RFA (Soft Delete)', async () => {
      const mockResponse = { data: { success: true } };
      vi.mocked(apiClient.delete).mockResolvedValue(mockResponse);
      const result = await rfaService.delete('uuid-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/rfas/uuid-1');
      expect(result).toEqual(mockResponse.data);
    });
  });
});
