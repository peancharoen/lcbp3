// File: frontend/hooks/__tests__/use-master-data.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for use-master-data hooks

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useDisciplines,
  useProjects,
  useContracts,
  useCorrespondenceTypes,
  useContractDrawingCategories,
  useShopMainCategories,
  useShopSubCategories,
  masterDataKeys,
} from '../use-master-data';
import { masterDataService } from '@/lib/services/master-data.service';
import { organizationService } from '@/lib/services/organization.service';
import { projectService } from '@/lib/services/project.service';
import { contractService } from '@/lib/services/contract.service';
import { toast } from 'sonner';

// Mock services
vi.mock('@/lib/services/master-data.service', () => ({
  masterDataService: {
    createOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    deleteOrganization: vi.fn(),
    getDisciplines: vi.fn(),
    getCorrespondenceTypes: vi.fn(),
    getContractDrawingCategories: vi.fn(),
    getShopMainCategories: vi.fn(),
    getShopSubCategories: vi.fn(),
  },
}));

vi.mock('@/lib/services/organization.service', () => ({
  organizationService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/lib/services/project.service', () => ({
  projectService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/lib/services/contract.service', () => ({
  contractService: {
    getAll: vi.fn(),
  },
}));

describe('use-master-data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('masterDataKeys', () => {
    it('ควรสร้าง cache keys ที่ถูกต้อง', () => {
      expect(masterDataKeys.all).toEqual(['masterData']);
      expect(masterDataKeys.organizations()).toEqual(['masterData', 'organizations']);
      expect(masterDataKeys.correspondenceTypes()).toEqual(['masterData', 'correspondenceTypes']);
      expect(masterDataKeys.disciplines('uuid-1')).toEqual(['masterData', 'disciplines', 'uuid-1']);
    });
  });

  describe('useOrganizations', () => {
    it('ควรดึงข้อมูลองค์กรสำเร็จ', async () => {
      const mockData = [{ publicId: 'uuid-org-1', organizationName: 'Org A' }];
      vi.mocked(organizationService.getAll).mockResolvedValue(mockData);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useOrganizations({ isActive: true }), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(organizationService.getAll).toHaveBeenCalledWith({ isActive: true });
    });
  });

  describe('useCreateOrganization', () => {
    it('ควรสร้างองค์กรสำเร็จและแสดง toast success', async () => {
      const mockResponse = { publicId: 'uuid-org-1', organizationName: 'New Org' };
      vi.mocked(masterDataService.createOrganization).mockResolvedValue(mockResponse);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateOrganization(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ organizationName: 'New Org', organizationCode: 'ORG' });
      });
      expect(masterDataService.createOrganization).toHaveBeenCalledWith({ organizationName: 'New Org', organizationCode: 'ORG' });
      expect(toast.success).toHaveBeenCalledWith('Organization created successfully');
    });

    it('ควรแสดง toast error เมื่อสร้างไม่สำเร็จ', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Duplicate code' } },
      };
      vi.mocked(masterDataService.createOrganization).mockRejectedValue(mockError);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateOrganization(), { wrapper });
      await act(async () => {
        try {
          await result.current.mutateAsync({ organizationName: 'New Org', organizationCode: 'ORG' });
        } catch {
          // คาดหวังว่าจะเกิด error
        }
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to create organization', {
        description: 'Duplicate code',
      });
    });
  });

  describe('useUpdateOrganization', () => {
    it('ควรแก้ไของค์กรสำเร็จและแสดง toast success', async () => {
      const mockResponse = { publicId: 'uuid-org-1', organizationName: 'Updated Org' };
      vi.mocked(masterDataService.updateOrganization).mockResolvedValue(mockResponse);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateOrganization(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ uuid: 'uuid-org-1', data: { organizationName: 'Updated Org' } });
      });
      expect(masterDataService.updateOrganization).toHaveBeenCalledWith('uuid-org-1', { organizationName: 'Updated Org' });
      expect(toast.success).toHaveBeenCalledWith('Organization updated successfully');
    });

    it('ควรแสดง toast error เมื่อแก้ไขไม่สำเร็จ', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Not found' } },
      };
      vi.mocked(masterDataService.updateOrganization).mockRejectedValue(mockError);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateOrganization(), { wrapper });
      await act(async () => {
        try {
          await result.current.mutateAsync({ uuid: 'uuid-org-1', data: { organizationName: 'Updated Org' } });
        } catch {
          // คาดหวังว่าจะเกิด error
        }
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to update organization', {
        description: 'Not found',
      });
    });
  });

  describe('useDeleteOrganization', () => {
    it('ควรลบองค์กรสำเร็จและแสดง toast success', async () => {
      vi.mocked(masterDataService.deleteOrganization).mockResolvedValue({});
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDeleteOrganization(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync('uuid-org-1');
      });
      expect(masterDataService.deleteOrganization).toHaveBeenCalledWith('uuid-org-1');
      expect(toast.success).toHaveBeenCalledWith('Organization deleted successfully');
    });

    it('ควรแสดง toast error เมื่อลบไม่สำเร็จ', async () => {
      const mockError = {
        message: 'Error',
        response: { data: { message: 'Constraint violation' } },
      };
      vi.mocked(masterDataService.deleteOrganization).mockRejectedValue(mockError);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDeleteOrganization(), { wrapper });
      await act(async () => {
        try {
          await result.current.mutateAsync('uuid-org-1');
        } catch {
          // คาดหวังว่าจะเกิด error
        }
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to delete organization', {
        description: 'Constraint violation',
      });
    });
  });

  describe('useDisciplines', () => {
    it('ควรดึงข้อมูลสาขา (Disciplines) สำเร็จ', async () => {
      const mockData = [{ publicId: 'uuid-disp-1', disciplineCode: 'CIV' }];
      vi.mocked(masterDataService.getDisciplines).mockResolvedValue(mockData);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDisciplines('uuid-contract-1'), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(masterDataService.getDisciplines).toHaveBeenCalledWith('uuid-contract-1');
    });
  });

  describe('useProjects', () => {
    it('ควรดึงข้อมูลโครงการ (Projects) สำเร็จ', async () => {
      const mockData = [{ publicId: 'uuid-proj-1', projectName: 'Project A' }];
      vi.mocked(projectService.getAll).mockResolvedValue(mockData);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useProjects(true), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(projectService.getAll).toHaveBeenCalledWith({ isActive: true });
    });
  });

  describe('useContracts', () => {
    it('ควรดึงข้อมูลสัญญา (Contracts) สำเร็จ', async () => {
      const mockData = [{ publicId: 'uuid-cont-1', name: 'Contract A' }];
      vi.mocked(contractService.getAll).mockResolvedValue(mockData);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useContracts('uuid-proj-1'), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(contractService.getAll).toHaveBeenCalledWith({ projectId: 'uuid-proj-1' });
    });
  });

  describe('useCorrespondenceTypes', () => {
    it('ควรดึงข้อมูลชนิดจดหมายนำส่งสำเร็จ', async () => {
      const mockData = [{ publicId: 'uuid-corr-1', typeCode: 'RFA' }];
      vi.mocked(masterDataService.getCorrespondenceTypes).mockResolvedValue(mockData);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCorrespondenceTypes(), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(masterDataService.getCorrespondenceTypes).toHaveBeenCalled();
    });
  });

  describe('useContractDrawingCategories', () => {
    it('ควรดึงข้อมูลหมวดหมู่แบบคู่สัญญาสำเร็จ', async () => {
      const mockData = [{ id: 1, categoryName: 'Design Drawing' }];
      vi.mocked(masterDataService.getContractDrawingCategories).mockResolvedValue(mockData);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useContractDrawingCategories('uuid-proj-1'), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(masterDataService.getContractDrawingCategories).toHaveBeenCalledWith('uuid-proj-1');
    });
  });

  describe('useShopMainCategories', () => {
    it('ควรดึงข้อมูลหมวดหมู่หลักแบบรายละเอียดก่อสร้างสำเร็จ', async () => {
      const mockData = [{ id: 1, mainCategoryName: 'Structural' }];
      vi.mocked(masterDataService.getShopMainCategories).mockResolvedValue(mockData);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useShopMainCategories(123), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(masterDataService.getShopMainCategories).toHaveBeenCalledWith(123);
    });
  });

  describe('useShopSubCategories', () => {
    it('ควรดึงข้อมูลหมวดหมู่ย่อยสำเร็จ', async () => {
      const mockData = [{ id: 10, subCategoryName: 'Foundation' }];
      vi.mocked(masterDataService.getShopSubCategories).mockResolvedValue(mockData);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useShopSubCategories(123, 1), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(masterDataService.getShopSubCategories).toHaveBeenCalledWith(123, 1);
    });
  });
});
