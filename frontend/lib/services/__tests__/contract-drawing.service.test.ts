// File: frontend/lib/services/__tests__/contract-drawing.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for contract-drawing service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contractDrawingService } from '../contract-drawing.service';
import apiClient from '@/lib/api/client';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('contractDrawingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควรดึงข้อมูลรายการ contract drawings สำเร็จ', async () => {
    const mockParams = { search: 'CD-01' };
    const mockResponse = { data: [{ publicId: '019505a1-7c3e-7000-8000-cd1111111111', drawingNo: 'CD-001' }] };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
    const result = await contractDrawingService.getAll(mockParams);
    expect(result).toEqual(mockResponse);
    expect(apiClient.get).toHaveBeenCalledWith('/drawings/contract', { params: mockParams });
  });

  it('ควรดึงรายละเอียดของ contract drawing สำเร็จ', async () => {
    const uuid = '019505a1-7c3e-7000-8000-cd1111111111';
    const mockResponse = { data: { publicId: uuid, drawingNo: 'CD-001' } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
    const result = await contractDrawingService.getByUuid(uuid);
    expect(result).toEqual(mockResponse);
    expect(apiClient.get).toHaveBeenCalledWith(`/drawings/contract/${uuid}`);
  });

  it('ควรสร้าง contract drawing สำเร็จ', async () => {
    const mockDto = { drawingNo: 'CD-001', subject: 'Test Contract Drawing' };
    const mockResponse = { data: { publicId: '019505a1-7c3e-7000-8000-cd1111111111' } };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
    const result = await contractDrawingService.create(mockDto as any);
    expect(result).toEqual(mockResponse);
    expect(apiClient.post).toHaveBeenCalledWith('/drawings/contract', mockDto);
  });

  it('ควรปรับปรุงข้อมูล contract drawing สำเร็จ', async () => {
    const uuid = '019505a1-7c3e-7000-8000-cd1111111111';
    const mockDto = { subject: 'Updated Contract Drawing' };
    const mockResponse = { data: { success: true } };
    vi.mocked(apiClient.put).mockResolvedValue({ data: mockResponse });
    const result = await contractDrawingService.update(uuid, mockDto as any);
    expect(result).toEqual(mockResponse);
    expect(apiClient.put).toHaveBeenCalledWith(`/drawings/contract/${uuid}`, mockDto);
  });

  it('ควรลบ contract drawing สำเร็จ', async () => {
    const uuid = '019505a1-7c3e-7000-8000-cd1111111111';
    const mockResponse = { data: { success: true } };
    vi.mocked(apiClient.delete).mockResolvedValue({ data: mockResponse });
    const result = await contractDrawingService.delete(uuid);
    expect(result).toEqual(mockResponse);
    expect(apiClient.delete).toHaveBeenCalledWith(`/drawings/contract/${uuid}`);
  });
});
