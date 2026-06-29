// File: frontend/lib/services/__tests__/ai.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for aiService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api/client';
import { aiService } from '../ai.service';

describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extract', () => {
    it('ควรส่งคำขอ POST /ai/extract เพื่อสกัดข้อมูลและส่งกลับผลลัพธ์สำเร็จ', async () => {
      const mockResult = {
        documentNumber: 'DOC-001',
        title: 'Document Title',
        confidenceScore: 0.95,
      };
      vi.mocked(api.post).mockResolvedValue({ data: mockResult });
      const dto = { filePublicId: 'file-123' };
      const result = await aiService.extract(dto);
      expect(api.post).toHaveBeenCalledWith('/ai/extract', dto);
      expect(result).toEqual(mockResult);
    });

    it('ควรจัดการการห่อหุ้มข้อมูล (nested data wrapper) ได้อย่างถูกต้อง', async () => {
      const mockResult = {
        documentNumber: 'DOC-001',
        title: 'Document Title',
        confidenceScore: 0.95,
      };
      vi.mocked(api.post).mockResolvedValue({ data: { data: mockResult } });
      const dto = { filePublicId: 'file-123' };
      const result = await aiService.extract(dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getMigrationList', () => {
    it('ควรดึงประวัติการอพยพข้อมูลพร้อมแบ่งหน้าได้ถูกต้อง', async () => {
      const mockResponse = {
        items: [
          {
            publicId: '019505a1-7c3e-7000-8000-log111111111',
            status: 'COMPLETED',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });
      const result = await aiService.getMigrationList({ page: 1, limit: 10 });
      expect(api.get).toHaveBeenCalledWith('/ai/migration', { params: { page: 1, limit: 10 } });
      expect(result).toEqual(mockResponse);
    });

    it('ควรคืนค่ารูปแบบแบ่งหน้าเริ่มต้นหากข้อมูลที่ได้รับไม่ถูกต้อง', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: null });
      const result = await aiService.getMigrationList({});
      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    });
  });

  describe('updateMigration', () => {
    it('ควรส่งคำขอ PATCH พร้อมแนบ Idempotency-Key สำเร็จ', async () => {
      const mockLog = {
        publicId: '019505a1-7c3e-7000-8000-log111111111',
        status: 'VERIFIED',
      };
      vi.mocked(api.patch).mockResolvedValue({ data: mockLog });
      const dto = { status: 'VERIFIED' as const };
      const result = await aiService.updateMigration(
        '019505a1-7c3e-7000-8000-log111111111',
        dto,
        'idempotency-123'
      );
      expect(api.patch).toHaveBeenCalledWith(
        '/ai/migration/019505a1-7c3e-7000-8000-log111111111',
        dto,
        { headers: { 'Idempotency-Key': 'idempotency-123' } }
      );
      expect(result).toEqual(mockLog);
    });
  });

  describe('submitFeedback', () => {
    it('ควรส่งคำขอ POST /ai/feedback พร้อมข้อมูลฟีดแบ็คสำเร็จ', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: {} });
      const dto = { logPublicId: 'log-1', rating: 5, comments: 'Good extraction' };
      await aiService.submitFeedback(dto);
      expect(api.post).toHaveBeenCalledWith('/ai/feedback', dto);
    });
  });
});
