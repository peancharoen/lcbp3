// File: frontend/lib/services/__tests__/organization.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for organization service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { organizationService } from '../organization.service';
import apiClient from '@/lib/api/client';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('organizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('ควรดึงข้อมูลรายการองค์กรทั้งหมดสำเร็จ (เมื่อ API ส่งกลับแบบ direct data)', async () => {
      const mockParams = { projectId: '019505a1-7c3e-7000-8000-proj11111111' };
      const mockResponse = [{ publicId: '019505a1-7c3e-7000-8000-org111111111', organizationName: 'Org A' }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
      const result = await organizationService.getAll(mockParams as any);
      expect(result).toEqual(mockResponse);
      expect(apiClient.get).toHaveBeenCalledWith('/organizations', { params: mockParams });
    });

    it('ควรดึงข้อมูลรายการองค์กรทั้งหมดสำเร็จ (เมื่อ API ส่งกลับแบบ wrapped ใน data.data)', async () => {
      const mockResponse = {
        data: {
          data: [{ publicId: '019505a1-7c3e-7000-8000-org111111111', organizationName: 'Org A' }],
        },
      };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse.data });
      const result = await organizationService.getAll();
      expect(result).toEqual(mockResponse.data.data);
      expect(apiClient.get).toHaveBeenCalledWith('/organizations', { params: undefined });
    });
  });

  describe('getByUuid', () => {
    it('ควรดึงข้อมูลองค์กรเดี่ยวตาม UUID สำเร็จ', async () => {
      const uuid = '019505a1-7c3e-7000-8000-org111111111';
      const mockResponse = { data: { publicId: uuid, organizationName: 'Org A' } };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
      const result = await organizationService.getByUuid(uuid);
      expect(result).toEqual(mockResponse);
      expect(apiClient.get).toHaveBeenCalledWith(`/organizations/${uuid}`);
    });
  });

  describe('create', () => {
    it('ควรสร้างองค์กรใหม่สำเร็จ', async () => {
      const mockDto = { organizationName: 'New Org', organizationCode: 'NEW' };
      const mockResponse = { data: { publicId: '019505a1-7c3e-7000-8000-org222222222' } };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
      const result = await organizationService.create(mockDto as any);
      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith('/organizations', mockDto);
    });
  });

  describe('update', () => {
    it('ควรปรับปรุงข้อมูลองค์กรสำเร็จ', async () => {
      const uuid = '019505a1-7c3e-7000-8000-org111111111';
      const mockDto = { organizationName: 'Updated Org' };
      const mockResponse = { data: { success: true } };
      vi.mocked(apiClient.patch).mockResolvedValue({ data: mockResponse });
      const result = await organizationService.update(uuid, mockDto as any);
      expect(result).toEqual(mockResponse);
      expect(apiClient.patch).toHaveBeenCalledWith(`/organizations/${uuid}`, mockDto);
    });
  });

  describe('delete', () => {
    it('ควรลบองค์กรสำเร็จ', async () => {
      const uuid = '019505a1-7c3e-7000-8000-org111111111';
      const mockResponse = { data: { success: true } };
      vi.mocked(apiClient.delete).mockResolvedValue({ data: mockResponse });
      const result = await organizationService.delete(uuid);
      expect(result).toEqual(mockResponse);
      expect(apiClient.delete).toHaveBeenCalledWith(`/organizations/${uuid}`);
    });
  });
});
