// File: frontend/lib/services/__tests__/user.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - unit tests for userService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import { userService } from '../user.service';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('ควรดึงข้อมูลผู้ใช้งานทั้งหมดและแปลงข้อมูล (transformUser)', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              user_id: 123,
              publicId: 'uuid-user-1',
              username: 'test1',
              assignments: [{ role: { roleName: 'Admin' } }],
            },
          ],
        },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await userService.getAll({ search: 'test1' });
      expect(apiClient.get).toHaveBeenCalledWith('/users', { params: { search: 'test1' } });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        user_id: 123,
        userId: 123,
        publicId: 'uuid-user-1',
        username: 'test1',
        assignments: [{ role: { roleName: 'Admin' } }],
        roles: [{ roleName: 'Admin' }],
      });
    });

    it('ควรคืนค่าเป็นอาเรย์ว่างเมื่อไม่พบข้อมูล', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: null });
      const result = await userService.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('getRoles', () => {
    it('ควรดึงข้อมูลบทบาทผู้ใช้สำเร็จ', async () => {
      const mockResponse = { data: [{ roleName: 'Admin' }, { roleName: 'User' }] };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await userService.getRoles();
      expect(apiClient.get).toHaveBeenCalledWith('/users/roles');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getByUuid', () => {
    it('ควรดึงรายละเอียดผู้ใช้ตาม uuid และทำการ transform', async () => {
      const mockResponse = {
        data: {
          userId: 456,
          publicId: 'uuid-user-2',
          username: 'test2',
        },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await userService.getByUuid('uuid-user-2');
      expect(apiClient.get).toHaveBeenCalledWith('/users/uuid-user-2');
      expect(result).toEqual({
        userId: 456,
        publicId: 'uuid-user-2',
        username: 'test2',
        roles: [],
      });
    });
  });

  describe('create', () => {
    it('ควรสร้างผู้ใช้งานใหม่สำเร็จ', async () => {
      const mockResponse = {
        data: {
          publicId: 'uuid-new',
          username: 'newuser',
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      const createDto = { username: 'newuser', email: 'new@example.com' };
      const result = await userService.create(createDto as any);
      expect(apiClient.post).toHaveBeenCalledWith('/users', createDto);
      expect(result).toEqual({
        publicId: 'uuid-new',
        username: 'newuser',
        roles: [],
      });
    });
  });

  describe('update', () => {
    it('ควรแก้ไขข้อมูลผู้ใช้งานสำเร็จ', async () => {
      const mockResponse = {
        data: {
          publicId: 'uuid-existing',
          username: 'updateduser',
        },
      };
      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);
      const updateDto = { username: 'updateduser' };
      const result = await userService.update('uuid-existing', updateDto);
      expect(apiClient.put).toHaveBeenCalledWith('/users/uuid-existing', updateDto);
      expect(result).toEqual({
        publicId: 'uuid-existing',
        username: 'updateduser',
        roles: [],
      });
    });
  });

  describe('delete', () => {
    it('ควรลบผู้ใช้งานสำเร็จ', async () => {
      const mockResponse = { data: { success: true } };
      vi.mocked(apiClient.delete).mockResolvedValue(mockResponse);
      const result = await userService.delete('uuid-existing');
      expect(apiClient.delete).toHaveBeenCalledWith('/users/uuid-existing');
      expect(result).toEqual(mockResponse.data);
    });
  });
});
