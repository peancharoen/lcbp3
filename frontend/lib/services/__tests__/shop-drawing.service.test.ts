// File: frontend/lib/services/__tests__/shop-drawing.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for shop-drawing service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shopDrawingService } from '../shop-drawing.service';
import apiClient from '@/lib/api/client';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('shopDrawingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควรดึงข้อมูลรายการ shop drawings สำเร็จ', async () => {
    const mockParams = { search: 'SD-01' };
    const mockResponse = { data: [{ publicId: '019505a1-7c3e-7000-8000-sd1111111111', drawingNo: 'SD-001' }] };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
    const result = await shopDrawingService.getAll(mockParams);
    expect(result).toEqual(mockResponse);
    expect(apiClient.get).toHaveBeenCalledWith('/drawings/shop', { params: mockParams });
  });

  it('ควรดึงรายละเอียดของ shop drawing สำเร็จ', async () => {
    const uuid = '019505a1-7c3e-7000-8000-sd1111111111';
    const mockResponse = { data: { publicId: uuid, drawingNo: 'SD-001' } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
    const result = await shopDrawingService.getByUuid(uuid);
    expect(result).toEqual(mockResponse);
    expect(apiClient.get).toHaveBeenCalledWith(`/drawings/shop/${uuid}`);
  });

  it('ควรสร้าง shop drawing สำเร็จ', async () => {
    const mockDto = { drawingNo: 'SD-001', subject: 'Test Shop Drawing' };
    const mockResponse = { data: { publicId: '019505a1-7c3e-7000-8000-sd1111111111' } };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
    const result = await shopDrawingService.create(mockDto as any);
    expect(result).toEqual(mockResponse);
    expect(apiClient.post).toHaveBeenCalledWith('/drawings/shop', mockDto);
  });

  it('ควรสร้าง revision ใหม่ของ shop drawing สำเร็จ', async () => {
    const uuid = '019505a1-7c3e-7000-8000-sd1111111111';
    const mockDto = { revisionNo: 'A', comment: 'New Revision' };
    const mockResponse = { data: { success: true } };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
    const result = await shopDrawingService.createRevision(uuid, mockDto as any);
    expect(result).toEqual(mockResponse);
    expect(apiClient.post).toHaveBeenCalledWith(`/drawings/shop/${uuid}/revisions`, mockDto);
  });
});
