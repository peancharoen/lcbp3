import { describe, it, expect, vi, beforeEach } from 'vitest';
import { correspondenceService } from '../correspondence.service';
import apiClient from '@/lib/api/client';

// apiClient is already mocked in vitest.setup.ts

describe('correspondenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should call GET /correspondences with params', async () => {
      const mockResponse = {
        data: [{ id: 1, title: 'Test' }],
        meta: { total: 1 },
      };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.getAll({ projectId: 1 });

      expect(apiClient.get).toHaveBeenCalledWith('/correspondences', {
        params: { projectId: 1 },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should call GET /correspondences without params', async () => {
      const mockResponse = { data: [] };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      await correspondenceService.getAll();

      expect(apiClient.get).toHaveBeenCalledWith('/correspondences', {
        params: undefined,
      });
    });
  });

  describe('getById', () => {
    it('should call GET /correspondences/:id', async () => {
      const mockData = { id: 1, title: 'Test' };
      // Service expects response.data.data (NestJS interceptor wrapper)
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockData } });

      const result = await correspondenceService.getById(1);

      expect(apiClient.get).toHaveBeenCalledWith('/correspondences/1');
      expect(result).toEqual(mockData);
    });

    it('should work with string id', async () => {
      const mockData = { id: 1 };
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockData } });

      await correspondenceService.getById('123');

      expect(apiClient.get).toHaveBeenCalledWith('/correspondences/123');
    });
  });

  describe('create', () => {
    it('should call POST /correspondences with data', async () => {
      const createDto = {
        title: 'New Correspondence',
        projectId: 1,
        correspondenceTypeId: 1,
      };
      const mockResponse = { id: 1, ...createDto };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.create(createDto);

      expect(apiClient.post).toHaveBeenCalledWith('/correspondences', createDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('update', () => {
    it('should call PUT /correspondences/:id with data', async () => {
      const updateData = { title: 'Updated Title' };
      const mockResponse = { id: 1, title: 'Updated Title' };
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.update(1, updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/correspondences/1', updateData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('delete', () => {
    it('should call DELETE /correspondences/:id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      const result = await correspondenceService.delete(1);

      expect(apiClient.delete).toHaveBeenCalledWith('/correspondences/1');
      expect(result).toEqual({});
    });
  });

  describe('submit', () => {
    it('should call POST /correspondences/:id/submit', async () => {
      const submitDto = { recipientIds: [2, 3] };
      const mockResponse = { id: 1, status: 'submitted' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.submit(1, submitDto);

      expect(apiClient.post).toHaveBeenCalledWith('/correspondences/1/submit', submitDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('processWorkflow', () => {
    it('should call POST /correspondences/:id/workflow', async () => {
      const workflowDto = { action: 'approve', comment: 'LGTM' };
      const mockResponse = { id: 1, status: 'approved' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.processWorkflow(1, workflowDto);

      expect(apiClient.post).toHaveBeenCalledWith('/correspondences/1/workflow', workflowDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('addReference', () => {
    it('should call POST /correspondences/:id/references', async () => {
      const referenceDto = { referencedDocumentId: 2, referenceType: 'reply_to' };
      const mockResponse = { id: 1 };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.addReference(1, referenceDto);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/correspondences/1/references',
        referenceDto
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('removeReference', () => {
    it('should call DELETE /correspondences/:id/references with body', async () => {
      const referenceDto = { referencedDocumentId: 2 };
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      const result = await correspondenceService.removeReference(1, referenceDto);

      expect(apiClient.delete).toHaveBeenCalledWith('/correspondences/1/references', {
        data: referenceDto,
      });
      expect(result).toEqual({});
    });
  });
});
