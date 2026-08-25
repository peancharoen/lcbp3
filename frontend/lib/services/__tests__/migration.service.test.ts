// File: frontend/lib/services/__tests__/migration.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for migration service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrationService } from '../migration.service';
import api from '@/lib/api/client';

// Mock api client
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('migrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getReviewQueue', () => {
    it('ควรดึงข้อมูลรายการ Queue และแปลงข้อมูลแบบแบ่งหน้าได้อย่างถูกต้อง', async () => {
      const mockParams = { page: 1, limit: 10, status: 'PENDING' as any };
      const mockResponse = {
        data: {
          items: [{ publicId: '019505a1-7c3e-7000-8000-item111111111', status: 'PENDING' }],
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10,
        },
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });

      const result = await migrationService.getReviewQueue(mockParams);

      expect(result.items).toEqual(mockResponse.data.items);
      expect(result.total).toBe(100);
      expect(api.get).toHaveBeenCalledWith('/migration/queue', { params: mockParams });
    });

    it('ควรจัดการกรณีที่ API ส่งกลับ Direct Data Array ได้อย่างถูกต้อง', async () => {
      const mockResponse = {
        data: [{ publicId: '019505a1-7c3e-7000-8000-item111111111', status: 'PENDING' }],
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });

      const result = await migrationService.getReviewQueue({});

      expect(result.items).toEqual(mockResponse.data);
      expect(result.total).toBe(1);
    });

    it('ควรส่งกลับโครงสร้างเปล่ากรณีที่ดึงข้อมูลล้มเหลวหรือไม่ตรงโครงสร้าง', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: null });

      const result = await migrationService.getReviewQueue({});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getQueueItem', () => {
    it('ควรดึงข้อมูล Queue item เดี่ยวตาม publicId สำเร็จ (ADR-019)', async () => {
      const mockPublicId = '019505a1-7c3e-7000-8000-item111111111';
      const mockResponse = {
        data: { publicId: mockPublicId, status: 'PENDING' },
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });

      const result = await migrationService.getQueueItem(mockPublicId);

      expect(result).toEqual(mockResponse.data);
      expect(api.get).toHaveBeenCalledWith(`/migration/queue/${mockPublicId}`);
    });
  });

  describe('getErrors', () => {
    it('ควรดึงข้อมูลรายการ Error Log สำเร็จ', async () => {
      const mockParams = { page: 1, limit: 20 };
      const mockResponse = {
        data: {
          items: [{ errorCode: 'ERR_001', errorMessage: 'Invalid UUID' }],
          total: 5,
        },
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockResponse });

      const result = await migrationService.getErrors(mockParams);

      expect(result.items).toEqual(mockResponse.data.items);
      expect(api.get).toHaveBeenCalledWith('/migration/errors', { params: mockParams });
    });
  });

  describe('approveQueueItem', () => {
    it('ควรอนุมัติรายการคิวสำเร็จพร้อมส่ง Idempotency-Key (ADR-019: publicId)', async () => {
      const mockPublicId = '019505a1-7c3e-7000-8000-item222222222';
      const mockPayload = { remarks: 'Approve' };
      const mockResponse = { data: { success: true } };

      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await migrationService.approveQueueItem(mockPublicId, mockPayload, 'idemp-key-123');

      expect(result).toEqual(mockResponse.data);
      expect(api.post).toHaveBeenCalledWith(`/migration/queue/${mockPublicId}/approve`, mockPayload, {
        headers: { 'idempotency-key': 'idemp-key-123' },
      });
    });
  });

  describe('rejectQueueItem', () => {
    it('ควรปฏิเสธรายการคิวสำเร็จ (ADR-019: publicId, ADR-016: Idempotency-Key)', async () => {
      const mockPublicId = '019505a1-7c3e-7000-8000-item333333333';
      const mockResponse = { data: { success: true } };

      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await migrationService.rejectQueueItem(mockPublicId, 'idemp-key-reject');

      expect(result).toEqual(mockResponse.data);
      expect(api.post).toHaveBeenCalledWith(
        `/migration/queue/${mockPublicId}/reject`,
        {},
        { headers: { 'idempotency-key': 'idemp-key-reject' } }
      );
    });
  });

  describe('commitBatch', () => {
    it('ควรบันทึก commit batch สำเร็จพร้อมส่ง Idempotency-Key (ADR-019: queuePublicId)', async () => {
      const mockPayload = {
        batchId: 'BATCH_UI_123',
        items: [
          {
            queuePublicId: '019505a1-7c3e-7000-8000-item444444444',
            dto: { document_number: 'DOC-001' },
          },
        ],
      };
      const mockResponse = { data: { success: true } };

      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await migrationService.commitBatch(mockPayload, 'idemp-key-456');

      expect(result).toEqual(mockResponse.data);
      expect(api.post).toHaveBeenCalledWith('/migration/commit_batch', mockPayload, {
        headers: { 'idempotency-key': 'idemp-key-456' },
      });
    });
  });
});
