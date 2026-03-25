import { describe, it, expect, vi, beforeEach } from 'vitest';
import { correspondenceService } from '../correspondence.service';
import apiClient from '@/lib/api/client';
import { WorkflowActionDto } from '@/types/dto/correspondence/workflow-action.dto';

// apiClient is already mocked in vitest.setup.ts

describe('correspondenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should call GET /correspondences with params', async () => {
      const mockResponse = {
        data: [{ id: 1, subject: 'Test' }],
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

  describe('getByUuid', () => {
    it('should call GET /correspondences/:uuid', async () => {
      const mockData = { id: 1, uuid: 'uuid-1', subject: 'Test' };
      // Service expects response.data.data (NestJS interceptor wrapper)
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockData } });

      const result = await correspondenceService.getByUuid('uuid-1');

      expect(apiClient.get).toHaveBeenCalledWith('/correspondences/uuid-1');
      expect(result).toEqual(mockData);
    });
  });

  describe('create', () => {
    it('should call POST /correspondences with data', async () => {
      const createDto = {
        subject: 'New Correspondence',
        projectId: 1,
        typeId: 1,
      };
      const mockResponse = { id: 1, ...createDto };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.create(createDto);

      expect(apiClient.post).toHaveBeenCalledWith('/correspondences', createDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('update', () => {
    it('should call PUT /correspondences/:uuid with data', async () => {
      const updateData = { subject: 'Updated Title' };
      const mockResponse = { id: 1, uuid: 'uuid-1', subject: 'Updated Title' };
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.update('uuid-1', updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/correspondences/uuid-1', updateData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('delete', () => {
    it('should call DELETE /correspondences/:uuid', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      const result = await correspondenceService.delete('uuid-1');

      expect(apiClient.delete).toHaveBeenCalledWith('/correspondences/uuid-1');
      expect(result).toEqual({});
    });
  });

  describe('submit', () => {
    it('should call POST /correspondences/:uuid/submit', async () => {
      const submitDto = { note: 'Ready for review' };
      const mockResponse = { id: 1, uuid: 'uuid-1', status: 'submitted' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.submit('uuid-1', submitDto);

      expect(apiClient.post).toHaveBeenCalledWith('/correspondences/uuid-1/submit', submitDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('processWorkflow', () => {
    it('should call POST /correspondences/:uuid/workflow', async () => {
      const workflowDto: WorkflowActionDto = { action: 'APPROVE', comments: 'LGTM' };
      const mockResponse = { id: 1, uuid: 'uuid-1', status: 'approved' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.processWorkflow('uuid-1', workflowDto);

      expect(apiClient.post).toHaveBeenCalledWith('/correspondences/uuid-1/workflow', workflowDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('addReference', () => {
    it('should call POST /correspondences/:uuid/references', async () => {
      const referenceDto = { targetId: 2, referenceType: 'reply_to' };
      const mockResponse = { id: 1, uuid: 'uuid-1' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await correspondenceService.addReference('uuid-1', referenceDto);

      expect(apiClient.post).toHaveBeenCalledWith('/correspondences/uuid-1/references', referenceDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('removeReference', () => {
    it('should call DELETE /correspondences/:uuid/references/:targetUuid', async () => {
      const targetUuid = 'target-uuid-2';
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      const result = await correspondenceService.removeReference('uuid-1', targetUuid);

      expect(apiClient.delete).toHaveBeenCalledWith('/correspondences/uuid-1/references/target-uuid-2');
      expect(result).toEqual({});
    });
  });
});
