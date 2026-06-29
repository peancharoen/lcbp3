// File: frontend/lib/services/__tests__/contract.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for contractService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import { contractService } from '../contract.service';

describe('contractService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('ควรดึงข้อมูลสัญญาและประมวลผลรูปแบบอาร์เรย์ได้อย่างถูกต้อง', async () => {
      const mockContracts = [
        {
          publicId: '019505a1-7c3e-7000-8000-contract111',
          contractName: 'Contract Alpha',
          project: {
            publicId: '019505a1-7c3e-7000-8000-project111',
            projectName: 'Project Alpha',
          },
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockContracts });
      const result = await contractService.getAll();
      expect(apiClient.get).toHaveBeenCalledWith('/contracts', { params: undefined });
      expect(result).toEqual(mockContracts);
    });

    it('ควรดึงข้อมูลและประมวลผลรูปแบบ nested data ได้อย่างถูกต้อง', async () => {
      const mockContracts = [
        {
          publicId: '019505a1-7c3e-7000-8000-contract111',
          contractName: 'Contract Alpha',
          project: {
            publicId: '019505a1-7c3e-7000-8000-project111',
            projectName: 'Project Alpha',
          },
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockContracts } });
      const result = await contractService.getAll({ projectId: 1 });
      expect(apiClient.get).toHaveBeenCalledWith('/contracts', { params: { projectId: 1 } });
      expect(result).toEqual(mockContracts);
    });

    it('ควรส่งกลับอาร์เรย์ว่างหากข้อมูลที่ได้รับไม่ใช่รูปแบบอาร์เรย์', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: null });
      const result = await contractService.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('getByUuid', () => {
    it('ควรดึงรายละเอียดสัญญาตาม UUID สำเร็จ', async () => {
      const mockContract = {
        publicId: '019505a1-7c3e-7000-8000-contract111',
        contractName: 'Contract Alpha',
      };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockContract });
      const result = await contractService.getByUuid('019505a1-7c3e-7000-8000-contract111');
      expect(apiClient.get).toHaveBeenCalledWith('/contracts/019505a1-7c3e-7000-8000-contract111');
      expect(result).toEqual(mockContract);
    });
  });

  describe('create', () => {
    it('ควรส่งคำขอ POST เพื่อสร้างสัญญาใหม่สำเร็จ', async () => {
      const createDto = { contractName: 'New Contract', contractCode: 'C-001', projectId: 1 };
      vi.mocked(apiClient.post).mockResolvedValue({ data: { publicId: 'new-uuid', ...createDto } });
      const result = await contractService.create(createDto);
      expect(apiClient.post).toHaveBeenCalledWith('/contracts', createDto);
      expect(result.contractName).toBe('New Contract');
    });
  });

  describe('update', () => {
    it('ควรส่งคำขอ PATCH เพื่ออัปเดตสัญญาสำเร็จ', async () => {
      const updateDto = { contractName: 'Updated Contract' };
      vi.mocked(apiClient.patch).mockResolvedValue({ data: { publicId: 'uuid', ...updateDto } });
      const result = await contractService.update('uuid', updateDto);
      expect(apiClient.patch).toHaveBeenCalledWith('/contracts/uuid', updateDto);
      expect(result.contractName).toBe('Updated Contract');
    });
  });

  describe('delete', () => {
    it('ควรส่งคำขอ DELETE เพื่อลบสัญญาสำเร็จ', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
      const result = await contractService.delete('uuid');
      expect(apiClient.delete).toHaveBeenCalledWith('/contracts/uuid');
      expect(result).toEqual({ success: true });
    });
  });
});
