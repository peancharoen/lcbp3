// File: frontend/lib/services/__tests__/search.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for searchService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import { searchService } from '../search.service';

describe('searchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('ควรส่งคำขอ GET /search พร้อมข้อมูลการค้นหาสำเร็จ', async () => {
      const mockResult = { items: [{ publicId: '019505a1-7c3e-7000-8000-doc111111111', title: 'Test doc' }] };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResult });
      const query = { q: 'test', limit: 10, offset: 0 };
      const result = await searchService.search(query);
      expect(apiClient.get).toHaveBeenCalledWith('/search', { params: query });
      expect(result).toEqual(mockResult);
    });
  });

  describe('suggest', () => {
    it('ควรดึงข้อมูล suggest และแกะค่า items ออกมาสำเร็จ', async () => {
      const mockResult = { items: ['test1', 'test2'] };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResult });
      const result = await searchService.suggest('test');
      expect(apiClient.get).toHaveBeenCalledWith('/search', { params: { q: 'test', limit: 5 } });
      expect(result).toEqual(['test1', 'test2']);
    });

    it('ควรคืนค่า raw response ใน suggest หากไม่มีฟิลด์ items', async () => {
      const mockResult = ['test1', 'test2'];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResult });
      const result = await searchService.suggest('test');
      expect(result).toEqual(['test1', 'test2']);
    });
  });

  describe('reindex', () => {
    it('ควรส่งคำขอ POST เพื่อสั่ง reindex สำเร็จ', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
      const result = await searchService.reindex('correspondence');
      expect(apiClient.post).toHaveBeenCalledWith('/search/reindex', { type: 'correspondence' });
      expect(result).toEqual({ success: true });
    });
  });
});
