import { describe, it, expect, vi, beforeEach } from 'vitest';
import { projectService } from '../project.service';
import apiClient from '@/lib/api/client';

// apiClient is already mocked in vitest.setup.ts

describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should call GET /projects with params', async () => {
      const mockData = [{ id: 1, name: 'Project Alpha' }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

      const result = await projectService.getAll({ search: 'alpha' });

      expect(apiClient.get).toHaveBeenCalledWith('/projects', {
        params: { search: 'alpha' },
      });
      expect(result).toEqual(mockData);
    });

    it('should unwrap paginated response', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: mockData, meta: { total: 1 } },
      });

      const result = await projectService.getAll();

      expect(result).toEqual(mockData);
    });
  });

  describe('getByUuid', () => {
    it('should call GET /projects/:uuid', async () => {
      const mockResponse = { id: 1, uuid: 'uuid-1', name: 'Project Alpha', code: 'P-001' };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await projectService.getByUuid('uuid-1');

      expect(apiClient.get).toHaveBeenCalledWith('/projects/uuid-1');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('create', () => {
    it('should call POST /projects with data', async () => {
      const createDto = { projectName: 'New Project', projectCode: 'P-002' };
      const mockResponse = { id: 2, ...createDto };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await projectService.create(createDto);

      expect(apiClient.post).toHaveBeenCalledWith('/projects', createDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('update', () => {
    it('should call PUT /projects/:uuid with data', async () => {
      const updateData = { projectName: 'Updated Project' };
      const mockResponse = { id: 1, uuid: 'uuid-1', projectName: 'Updated Project' };
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockResponse });

      const result = await projectService.update('uuid-1', updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/projects/uuid-1', updateData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('delete', () => {
    it('should call DELETE /projects/:uuid', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      const result = await projectService.delete('uuid-1');

      expect(apiClient.delete).toHaveBeenCalledWith('/projects/uuid-1');
      expect(result).toEqual({});
    });
  });
});
