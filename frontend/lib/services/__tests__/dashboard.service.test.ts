// File: frontend/lib/services/__tests__/dashboard.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - unit tests for dashboardService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import { dashboardService } from '../dashboard.service';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('dashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStats', () => {
    it('ควรดึงข้อมูลสถิติของแดชบอร์ดสำเร็จ', async () => {
      const mockResponse = { data: { totalDocuments: 100, pendingApprovals: 5 } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await dashboardService.getStats('uuid-proj-1');
      expect(apiClient.get).toHaveBeenCalledWith('/dashboard/stats', { params: { projectId: 'uuid-proj-1' } });
      expect(result).toEqual(mockResponse.data);
    });

    it('ควรดึงข้อมูลสถิติโดยไม่ต้องส่ง projectId', async () => {
      const mockResponse = { data: { totalDocuments: 200 } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await dashboardService.getStats();
      expect(apiClient.get).toHaveBeenCalledWith('/dashboard/stats', { params: undefined });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getRecentActivity', () => {
    it('ควรดึงประวัติการเคลื่อนไหวล่าสุดและจัดรูปแบบให้ถูกต้อง', async () => {
      const mockResponse = {
        data: [
          {
            id: 'act-1',
            action: 'CREATE',
            entityType: 'RFA',
            entityId: 'uuid-rfa',
            details: { description: 'สร้างเอกสาร RFA ใหม่' },
            createdAt: '2026-01-01T00:00:00Z',
            user: { firstName: 'สมชาย', lastName: 'รักดี', username: 'somchai' },
          },
          {
            id: 'act-2',
            action: 'UPDATE',
            entityType: 'Transmittal',
            entityId: 'uuid-trans',
            createdAt: '2026-01-01T00:00:00Z',
            user: { username: 'testuser' },
          },
          {
            id: 'act-3',
            action: 'DELETE',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await dashboardService.getRecentActivity('uuid-proj-1');
      expect(result).toHaveLength(3);
      expect(result[0].user.name).toBe('สมชาย รักดี');
      expect(result[0].user.initials).toBe('สร');
      expect(result[0].description).toBe('สร้างเอกสาร RFA ใหม่');
      expect(result[0].targetUrl).toBe('/rfas/uuid-rfa');
      expect(result[1].user.name).toBe('testuser');
      expect(result[1].user.initials).toBe('T');
      expect(result[1].description).toBe('UPDATE Transmittal uuid-trans');
      expect(result[1].targetUrl).toBe('/transmittals/uuid-trans');
      expect(result[2].user.name).toBe('System');
      expect(result[2].user.initials).toBe('S');
      expect(result[2].targetUrl).toBe('/correspondences/');
    });

    it('ควรคืนค่าเป็นอาเรย์ว่างเมื่อเกิดข้อผิดพลาดจาก API', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('API Failure'));
      const result = await dashboardService.getRecentActivity();
      expect(result).toEqual([]);
    });

    it('ควรคืนค่าเป็นอาเรย์ว่างเมื่อข้อมูลไม่ใช้รูปแบบอาเรย์', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { message: 'Not an array' } });
      const result = await dashboardService.getRecentActivity();
      expect(result).toEqual([]);
    });
  });

  describe('getPendingTasks', () => {
    it('ควรดึงข้อมูลงานที่ค้างและคำนวณจำนวนวันล่วงเลยกับความสำคัญ', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      const mockResponse = {
        data: {
          data: [
            {
              instanceId: 'inst-1',
              workflowCode: 'WF-RFA',
              currentState: 'REVIEWING',
              entityType: 'RFA',
              entityId: 'uuid-rfa-1',
              documentNumber: 'RFA-001',
              subject: 'งานด่วนพิเศษ',
              assignedAt: oneDayAgo.toISOString(),
            },
            {
              instanceId: 'inst-2',
              workflowCode: 'WF-TR',
              currentState: 'APPROVED',
              entityType: 'Transmittal',
              entityId: 'uuid-tr-1',
              documentNumber: 'TR-001',
              subject: '',
              assignedAt: fourDaysAgo.toISOString(),
            },
          ],
        },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      const result = await dashboardService.getPendingTasks('uuid-proj-1');
      expect(result).toHaveLength(2);
      expect(result[0].publicId).toBe('inst-1');
      expect(result[0].title).toBe('งานด่วนพิเศษ');
      expect(result[0].daysOverdue).toBe(1);
      expect(result[0].priority).toBe('MEDIUM');
      expect(result[0].url).toBe('/rfas/uuid-rfa-1');
      expect(result[1].publicId).toBe('inst-2');
      expect(result[1].title).toBe('TR-001');
      expect(result[1].daysOverdue).toBe(4);
      expect(result[1].priority).toBe('HIGH');
      expect(result[1].url).toBe('/transmittals/uuid-tr-1');
    });

    it('ควรคืนค่าเป็นอาเรย์ว่างเมื่อเกิดข้อผิดพลาดจาก API', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('API Failure'));
      const result = await dashboardService.getPendingTasks();
      expect(result).toEqual([]);
    });
  });
});
