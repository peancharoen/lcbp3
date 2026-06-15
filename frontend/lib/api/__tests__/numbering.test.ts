// File: lib/api/__tests__/numbering.test.ts
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { describe, it, expect, vi } from 'vitest';
import { numberingApi } from '../numbering';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from '@/lib/api/client';

describe('numberingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTemplates', () => {
    it('ควร return array of templates', async () => {
      const mockTemplates = [{ id: 1, formatTemplate: 'TEST-{YYYY}-{NNNN}' }];
      (apiClient.get as any).mockResolvedValue({ data: mockTemplates });

      const result = await numberingApi.getTemplates();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockTemplates);
    });

    it('ควร handle nested data structure', async () => {
      const mockTemplates = [{ id: 1, formatTemplate: 'TEST-{YYYY}-{NNNN}' }];
      (apiClient.get as any).mockResolvedValue({ data: { data: mockTemplates } });

      const result = await numberingApi.getTemplates();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockTemplates);
    });
  });

  describe('getTemplatesByProject', () => {
    it('ควร call API ด้วย projectId parameter', async () => {
      (apiClient.get as any).mockResolvedValue({ data: [] });

      await numberingApi.getTemplatesByProject(1);
      
      expect(apiClient.get).toHaveBeenCalledWith('/admin/document-numbering/templates?projectId=1');
    });
  });

  describe('getTemplate', () => {
    it('ควร return template เมื่อ id ถูกต้อง', async () => {
      const mockTemplates = [{ id: 1, formatTemplate: 'TEST-{YYYY}-{NNNN}' }];
      (apiClient.get as any).mockResolvedValue({ data: mockTemplates });

      const result = await numberingApi.getTemplate(1);
      
      expect(result).toEqual(mockTemplates[0]);
    });

    it('ควร return undefined เมื่อ id ไม่พบ', async () => {
      const mockTemplates = [{ id: 1, formatTemplate: 'TEST-{YYYY}-{NNNN}' }];
      (apiClient.get as any).mockResolvedValue({ data: mockTemplates });

      const result = await numberingApi.getTemplate(999);
      
      expect(result).toBeUndefined();
    });
  });

  describe('saveTemplate', () => {
    it('ควร call API ด้วย DTO ที่ clean แล้ว', async () => {
      const mockTemplate = { id: 1, formatTemplate: 'TEST-{YYYY}-{NNNN}' };
      (apiClient.post as any).mockResolvedValue({ data: mockTemplate });

      const dto = {
        projectId: 1,
        correspondenceTypeId: null,
        formatTemplate: 'TEST-{YYYY}-{NNNN}',
      };

      const result = await numberingApi.saveTemplate(dto);
      
      expect(apiClient.post).toHaveBeenCalledWith('/admin/document-numbering/templates', expect.any(Object));
      expect(result).toEqual(mockTemplate);
    });
  });

  describe('deleteTemplate', () => {
    it('ควร call API ด้วย id', async () => {
      (apiClient.delete as any).mockResolvedValue({});

      await numberingApi.deleteTemplate(1);
      
      expect(apiClient.delete).toHaveBeenCalledWith('/admin/document-numbering/templates/1');
    });
  });

  describe('getAuditLogs', () => {
    it('ควร return array of audit logs', async () => {
      const mockLogs = [{ id: 1, generatedNumber: 'TEST-001' }];
      (apiClient.get as any).mockResolvedValue({ data: mockLogs });

      const result = await numberingApi.getAuditLogs();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockLogs);
    });

    it('ควร call API ด้วย limit parameter', async () => {
      (apiClient.get as any).mockResolvedValue({ data: [] });

      await numberingApi.getAuditLogs(50);
      
      expect(apiClient.get).toHaveBeenCalledWith('/document-numbering/logs/audit?limit=50');
    });
  });

  describe('getErrorLogs', () => {
    it('ควร return array of error logs', async () => {
      const mockErrors = [{ id: 1, errorMessage: 'Test error' }];
      (apiClient.get as any).mockResolvedValue({ data: mockErrors });

      const result = await numberingApi.getErrorLogs();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockErrors);
    });
  });

  describe('getMetrics', () => {
    it('ควร return metrics ที่มี audit และ errors', async () => {
      const mockMetrics = { audit: [], errors: [] };
      (apiClient.get as any).mockResolvedValue({ data: mockMetrics });

      const result = await numberingApi.getMetrics();
      
      expect(result).toHaveProperty('audit');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('manualOverride', () => {
    it('ควร call API ด้วย DTO', async () => {
      const mockResponse = { success: true, message: 'Override successful' };
      (apiClient.post as any).mockResolvedValue({ data: mockResponse });

      const dto = { projectId: 1, correspondenceTypeId: null, year: 2026, newValue: 100 };
      const result = await numberingApi.manualOverride(dto);
      
      expect(apiClient.post).toHaveBeenCalledWith('/admin/document-numbering/manual-override', dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('voidAndReplace', () => {
    it('ควร call API ด้วย DTO', async () => {
      const mockResponse = { newNumber: 'TEST-002', auditId: 123 };
      (apiClient.post as any).mockResolvedValue({ data: mockResponse });

      const dto = { documentId: 1, reason: 'Test reason' };
      const result = await numberingApi.voidAndReplace(dto);
      
      expect(apiClient.post).toHaveBeenCalledWith('/admin/document-numbering/void-and-replace', dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('cancelNumber', () => {
    it('ควร call API ด้วย DTO', async () => {
      const mockResponse = { success: true };
      (apiClient.post as any).mockResolvedValue({ data: mockResponse });

      const dto = { documentNumber: 'TEST-001', reason: 'Test reason' };
      const result = await numberingApi.cancelNumber(dto);
      
      expect(apiClient.post).toHaveBeenCalledWith('/admin/document-numbering/cancel', dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('bulkImport', () => {
    it('ควร call API ด้วย items array', async () => {
      const mockResponse = { imported: 10, errors: [] };
      (apiClient.post as any).mockResolvedValue({ data: mockResponse });

      const items = [{ projectId: 1, correspondenceTypeId: null, year: 2026, lastNumber: 100 }];
      const result = await numberingApi.bulkImport(items);
      
      expect(apiClient.post).toHaveBeenCalledWith('/admin/document-numbering/bulk-import', items);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateCounter', () => {
    it('ควร call API ด้วย counterId และ sequence', async () => {
      (apiClient.patch as any).mockResolvedValue({});

      await numberingApi.updateCounter(1, 100);
      
      expect(apiClient.patch).toHaveBeenCalledWith('/document-numbering/counters/1', { sequence: 100 });
    });
  });

  describe('previewNumber', () => {
    it('ควร return preview number', async () => {
      const mockResponse = { previewNumber: 'TEST-2026-0001', nextSequence: 1, isDefault: true };
      (apiClient.post as any).mockResolvedValue({ data: mockResponse });

      const ctx = { projectId: 1, originatorOrganizationId: 1, correspondenceTypeId: 1 };
      const result = await numberingApi.previewNumber(ctx);
      
      expect(apiClient.post).toHaveBeenCalledWith('/document-numbering/preview', ctx);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('generateTestNumber', () => {
    it('ควร return mock test number', async () => {
      const result = await numberingApi.generateTestNumber(1, { organizationId: '1', disciplineId: '1' });
      
      expect(result).toHaveProperty('number');
      expect(result.number).toMatch(/^TEST-\d{4}-\d{4}$/);
    });
  });
});
