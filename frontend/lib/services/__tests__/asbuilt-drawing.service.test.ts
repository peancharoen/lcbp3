// File: frontend/lib/services/__tests__/asbuilt-drawing.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for asbuilt-drawing service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { asBuiltDrawingService } from '../asbuilt-drawing.service';
import apiClient from '@/lib/api/client';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('asBuiltDrawingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควรดึงข้อมูลรายการ as built drawings สำเร็จ', async () => {
    const mockParams = { search: 'AD-01' };
    const mockResponse = { data: [{ publicId: '019505a1-7c3e-7000-8000-ad1111111111', drawingNo: 'AD-001' }] };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
    const result = await asBuiltDrawingService.getAll(mockParams);
    expect(result).toEqual(mockResponse);
    expect(apiClient.get).toHaveBeenCalledWith('/drawings/asbuilt', { params: mockParams });
  });

  it('ควรดึงรายละเอียดของ as built drawing สำเร็จ', async () => {
    const uuid = '019505a1-7c3e-7000-8000-ad1111111111';
    const mockResponse = { data: { publicId: uuid, drawingNo: 'AD-001' } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
    const result = await asBuiltDrawingService.getByUuid(uuid);
    expect(result).toEqual(mockResponse);
    expect(apiClient.get).toHaveBeenCalledWith(`/drawings/asbuilt/${uuid}`);
  });

  it('ควรสร้าง as built drawing สำเร็จ', async () => {
    const mockDto = { drawingNo: 'AD-001', subject: 'Test As Built Drawing' };
    const mockResponse = { data: { publicId: '019505a1-7c3e-7000-8000-ad1111111111' } };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
    const result = await asBuiltDrawingService.create(mockDto as any);
    expect(result).toEqual(mockResponse);
    expect(apiClient.post).toHaveBeenCalledWith('/drawings/asbuilt', mockDto);
  });

  it('ควรสร้าง revision ใหม่ของ as built drawing สำเร็จ', async () => {
    const uuid = '019505a1-7c3e-7000-8000-ad1111111111';
    const mockDto = { revisionNo: 'A', comment: 'New Revision' };
    const mockResponse = { data: { success: true } };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
    const result = await asBuiltDrawingService.createRevision(uuid, mockDto as any);
    expect(result).toEqual(mockResponse);
    expect(apiClient.post).toHaveBeenCalledWith(`/drawings/asbuilt/${uuid}/revisions`, mockDto);
  });
});
