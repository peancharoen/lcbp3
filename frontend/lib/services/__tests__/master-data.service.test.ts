import { describe, it, expect, vi, beforeEach } from 'vitest';
import { masterDataService } from '../master-data.service';
import apiClient from '@/lib/api/client';

// apiClient is already mocked in vitest.setup.ts

describe('masterDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Tags ---
  describe('Tags', () => {
    describe('getTags', () => {
      it('should call GET /tags with params', async () => {
        const mockTags = [{ id: 1, name: 'Important' }];
        vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockTags } });

        const result = await masterDataService.getTags({ search: 'test' });

        expect(apiClient.get).toHaveBeenCalledWith('/master/tags', { params: { search: 'test' } });
        expect(result).toEqual(mockTags);
      });

      it('should handle unwrapped response', async () => {
        const mockTags = [{ id: 1, name: 'Urgent' }];
        vi.mocked(apiClient.get).mockResolvedValue({ data: mockTags });

        const result = await masterDataService.getTags();

        expect(result).toEqual(mockTags);
      });
    });

    describe('createTag', () => {
      it('should call POST /tags', async () => {
        const createDto = { name: 'New Tag', color: '#ff0000' };
        vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1, ...createDto } });

        const result = await masterDataService.createTag(createDto);

        expect(apiClient.post).toHaveBeenCalledWith('/master/tags', createDto);
        expect(result).toEqual({ id: 1, ...createDto });
      });
    });

    describe('updateTag', () => {
      it('should call PUT /tags/:id', async () => {
        const updateDto = { name: 'Updated Tag' };
        vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 1, ...updateDto } });

        const result = await masterDataService.updateTag(1, updateDto);

        expect(apiClient.patch).toHaveBeenCalledWith('/master/tags/1', updateDto);
        expect(result).toEqual({ id: 1, ...updateDto });
      });
    });

    describe('deleteTag', () => {
      it('should call DELETE /tags/:id', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

        const result = await masterDataService.deleteTag(1);

        expect(apiClient.delete).toHaveBeenCalledWith('/master/tags/1');
        expect(result).toEqual({});
      });
    });
  });

  // --- Organizations ---
  describe('Organizations', () => {
    describe('getOrganizations', () => {
      it('should call GET /organizations and unwrap paginated response', async () => {
        const mockOrgs = [{ organizationId: 1, name: 'Org A' }];
        vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockOrgs } });

        const result = await masterDataService.getOrganizations();

        expect(apiClient.get).toHaveBeenCalledWith('/organizations', { params: undefined });
        expect(result).toEqual(mockOrgs);
      });

      it('should handle array response', async () => {
        const mockOrgs = [{ organizationId: 1 }];
        vi.mocked(apiClient.get).mockResolvedValue({ data: mockOrgs });

        const result = await masterDataService.getOrganizations();

        expect(result).toEqual(mockOrgs);
      });

      it('should return empty array as fallback', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: {} });

        const result = await masterDataService.getOrganizations();

        expect(result).toEqual([]);
      });
    });

    describe('createOrganization', () => {
      it('should call POST /organizations', async () => {
        const createDto = { name: 'New Org', code: 'ORG-001' };
        vi.mocked(apiClient.post).mockResolvedValue({ data: { organizationId: 1, ...createDto } });

        const result = await masterDataService.createOrganization(createDto);

        expect(apiClient.post).toHaveBeenCalledWith('/organizations', createDto);
        expect(result.organizationId).toBe(1);
      });
    });

    describe('updateOrganization', () => {
      it('should call PUT /organizations/:id', async () => {
        const updateDto = { name: 'Updated Org' };
        vi.mocked(apiClient.put).mockResolvedValue({ data: { organizationId: 1, ...updateDto } });

        const result = await masterDataService.updateOrganization(1, updateDto);

        expect(apiClient.put).toHaveBeenCalledWith('/organizations/1', updateDto);
        expect(result.name).toBe('Updated Org');
      });
    });

    describe('deleteOrganization', () => {
      it('should call DELETE /organizations/:id', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

        await masterDataService.deleteOrganization(1);

        expect(apiClient.delete).toHaveBeenCalledWith('/organizations/1');
      });
    });
  });

  // --- Disciplines ---
  describe('Disciplines', () => {
    describe('getDisciplines', () => {
      it('should call GET /master/disciplines with contractId', async () => {
        const mockDisciplines = [{ id: 1, name: 'Civil' }];
        vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockDisciplines } });

        const result = await masterDataService.getDisciplines(1);

        expect(apiClient.get).toHaveBeenCalledWith('/master/disciplines', {
          params: { contractId: 1 },
        });
        expect(result).toEqual(mockDisciplines);
      });
    });

    describe('createDiscipline', () => {
      it('should call POST /master/disciplines', async () => {
        const createDto = { name: 'Electrical', contractId: 1 };
        vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1, ...createDto } });

        const result = await masterDataService.createDiscipline(createDto);

        expect(apiClient.post).toHaveBeenCalledWith('/master/disciplines', createDto);
        expect(result.name).toBe('Electrical');
      });
    });

    describe('deleteDiscipline', () => {
      it('should call DELETE /master/disciplines/:id', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

        await masterDataService.deleteDiscipline(1);

        expect(apiClient.delete).toHaveBeenCalledWith('/master/disciplines/1');
      });
    });
  });

  // --- SubTypes ---
  describe('SubTypes', () => {
    describe('getSubTypes', () => {
      it('should call GET /master/sub-types with contractId and typeId', async () => {
        const mockSubTypes = [{ id: 1, name: 'Submittal' }];
        vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockSubTypes } });

        const result = await masterDataService.getSubTypes(1, 2);

        expect(apiClient.get).toHaveBeenCalledWith('/master/sub-types', {
          params: { contractId: 1, correspondenceTypeId: 2 },
        });
        expect(result).toEqual(mockSubTypes);
      });
    });

    describe('createSubType', () => {
      it('should call POST /master/sub-types', async () => {
        const createDto = { name: 'New SubType' };
        vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1, ...createDto } });

        const result = await masterDataService.createSubType(createDto);

        expect(apiClient.post).toHaveBeenCalledWith('/master/sub-types', createDto);
        expect(result).toEqual({ id: 1, ...createDto });
      });
    });
  });

  // --- RFA Types ---
  describe('RfaTypes', () => {
    describe('getRfaTypes', () => {
      it('should call GET /master/rfa-types', async () => {
        const mockTypes = [{ id: 1, name: 'Material Approval' }];
        vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockTypes } });

        const result = await masterDataService.getRfaTypes(1);

        expect(apiClient.get).toHaveBeenCalledWith('/master/rfa-types', {
          params: { contractId: 1 },
        });
        expect(result).toEqual(mockTypes);
      });
    });

    describe('createRfaType', () => {
      it('should call POST /master/rfa-types', async () => {
        const data = { name: 'New RFA Type' };
        vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1, ...data } });

        const result = await masterDataService.createRfaType(data);

        expect(apiClient.post).toHaveBeenCalledWith('/master/rfa-types', data);
        expect(result).toEqual({ id: 1, ...data });
      });
    });

    describe('updateRfaType', () => {
      it('should call PATCH /master/rfa-types/:id', async () => {
        const data = { name: 'Updated Type' };
        vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 1, ...data } });

        await masterDataService.updateRfaType(1, data);

        expect(apiClient.patch).toHaveBeenCalledWith('/master/rfa-types/1', data);
      });
    });

    describe('deleteRfaType', () => {
      it('should call DELETE /master/rfa-types/:id', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

        await masterDataService.deleteRfaType(1);

        expect(apiClient.delete).toHaveBeenCalledWith('/master/rfa-types/1');
      });
    });
  });

  // --- Correspondence Types ---
  describe('CorrespondenceTypes', () => {
    describe('getCorrespondenceTypes', () => {
      it('should call GET /master/correspondence-types', async () => {
        const mockTypes = [{ id: 1, name: 'Letter' }];
        vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockTypes } });

        const result = await masterDataService.getCorrespondenceTypes();

        expect(apiClient.get).toHaveBeenCalledWith('/master/correspondence-types');
        expect(result).toEqual(mockTypes);
      });
    });

    describe('createCorrespondenceType', () => {
      it('should call POST /master/correspondence-types', async () => {
        const data = { name: 'Memo' };
        vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 2, ...data } });

        await masterDataService.createCorrespondenceType(data);

        expect(apiClient.post).toHaveBeenCalledWith('/master/correspondence-types', data);
      });
    });

    describe('updateCorrespondenceType', () => {
      it('should call PATCH /master/correspondence-types/:id', async () => {
        const data = { name: 'Updated Type' };
        vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 1, ...data } });

        await masterDataService.updateCorrespondenceType(1, data);

        expect(apiClient.patch).toHaveBeenCalledWith('/master/correspondence-types/1', data);
      });
    });

    describe('deleteCorrespondenceType', () => {
      it('should call DELETE /master/correspondence-types/:id', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

        await masterDataService.deleteCorrespondenceType(1);

        expect(apiClient.delete).toHaveBeenCalledWith('/master/correspondence-types/1');
      });
    });
  });

  // --- Number Format ---
  describe('NumberFormat', () => {
    describe('saveNumberFormat', () => {
      it('should call POST /document-numbering/formats', async () => {
        const data = { projectId: 1, correspondenceTypeId: 1, format: '{PREFIX}-{YYYY}-{SEQ}' };
        vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1, ...data } });

        await masterDataService.saveNumberFormat(data);

        expect(apiClient.post).toHaveBeenCalledWith('/document-numbering/formats', data);
      });
    });

    describe('getNumberFormat', () => {
      it('should call GET /document-numbering/formats with params', async () => {
        const mockFormat = { id: 1, format: '{PREFIX}-{SEQ}' };
        vi.mocked(apiClient.get).mockResolvedValue({ data: mockFormat });

        const result = await masterDataService.getNumberFormat(1, 2);

        expect(apiClient.get).toHaveBeenCalledWith('/document-numbering/formats', {
          params: { projectId: 1, correspondenceTypeId: 2 },
        });
        expect(result).toEqual(mockFormat);
      });
    });
  });
});
