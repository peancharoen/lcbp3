// File: frontend/lib/services/__tests__/drawing-master-data.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for drawing-master-data service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawingMasterDataService } from '../drawing-master-data.service';
import apiClient from '@/lib/api/client';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('drawingMasterDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Contract Volumes', () => {
    it('ควรดึงข้อมูล contract volumes สำเร็จ', async () => {
      const mockResponse = { data: [{ id: 1, volumeCode: 'V1', volumeName: 'Vol 1' }] };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.getContractVolumes('proj-uuid-1');
      expect(result).toEqual(mockResponse.data);
      expect(apiClient.get).toHaveBeenCalledWith('/drawings/master-data/contract/volumes', {
        params: { projectId: 'proj-uuid-1' },
      });
    });

    it('ควรสร้าง contract volume สำเร็จ', async () => {
      const mockDto = { projectId: 'proj-uuid-1', volumeCode: 'V1', volumeName: 'Vol 1', sortOrder: 1 };
      const mockResponse = { data: { id: 1, volumeCode: 'V1' } };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.createContractVolume(mockDto);
      expect(result).toEqual(mockResponse.data);
      expect(apiClient.post).toHaveBeenCalledWith('/drawings/master-data/contract/volumes', mockDto);
    });

    it('ควรปรับปรุง contract volume สำเร็จ', async () => {
      const mockDto = { volumeName: 'Updated Vol 1' };
      const mockResponse = { data: { id: 1, volumeName: 'Updated Vol 1' } };
      vi.mocked(apiClient.patch).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.updateContractVolume(1, mockDto);
      expect(result).toEqual(mockResponse.data);
      expect(apiClient.patch).toHaveBeenCalledWith('/drawings/master-data/contract/volumes/1', mockDto);
    });

    it('ควรลบ contract volume สำเร็จ', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({} as any);
      await drawingMasterDataService.deleteContractVolume(1);
      expect(apiClient.delete).toHaveBeenCalledWith('/drawings/master-data/contract/volumes/1');
    });
  });

  describe('Contract Categories', () => {
    it('ควรดึงข้อมูล contract categories สำเร็จ', async () => {
      const mockResponse = { data: [{ id: 2, catCode: 'C2', catName: 'Cat 2' }] };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.getContractCategories('proj-uuid-1');
      expect(result).toEqual(mockResponse.data);
      expect(apiClient.get).toHaveBeenCalledWith('/drawings/master-data/contract/categories', {
        params: { projectId: 'proj-uuid-1' },
      });
    });

    it('ควรสร้าง contract category สำเร็จ', async () => {
      const mockDto = { projectId: 'proj-uuid-1', catCode: 'C2', catName: 'Cat 2', sortOrder: 1 };
      const mockResponse = { data: { id: 2, catCode: 'C2' } };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.createContractCategory(mockDto);
      expect(result).toEqual(mockResponse.data);
      expect(apiClient.post).toHaveBeenCalledWith('/drawings/master-data/contract/categories', mockDto);
    });

    it('ควรปรับปรุง contract category สำเร็จ', async () => {
      const mockDto = { catName: 'Updated Cat 2' };
      const mockResponse = { data: { id: 2, catName: 'Updated Cat 2' } };
      vi.mocked(apiClient.patch).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.updateContractCategory(2, mockDto);
      expect(result).toEqual(mockResponse.data);
      expect(apiClient.patch).toHaveBeenCalledWith('/drawings/master-data/contract/categories/2', mockDto);
    });

    it('ควรลบ contract category สำเร็จ', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({} as any);
      await drawingMasterDataService.deleteContractCategory(2);
      expect(apiClient.delete).toHaveBeenCalledWith('/drawings/master-data/contract/categories/2');
    });
  });

  describe('Contract Sub-categories', () => {
    it('ควรดึงข้อมูล contract sub-categories สำเร็จ', async () => {
      const mockResponse = [{ id: 3, subCatCode: 'SC3', subCatName: 'Sub 3' }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.getContractSubCategories('proj-uuid-1');
      expect(result).toEqual(mockResponse);
      expect(apiClient.get).toHaveBeenCalledWith('/drawings/master-data/contract/sub-categories', {
        params: { projectId: 'proj-uuid-1' },
      });
    });

    it('ควรสร้าง contract sub-category สำเร็จ', async () => {
      const mockDto = { projectId: 'proj-uuid-1', subCatCode: 'SC3', subCatName: 'Sub 3', sortOrder: 1 };
      const mockResponse = { id: 3, subCatCode: 'SC3' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.createContractSubCategory(mockDto);
      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith('/drawings/master-data/contract/sub-categories', mockDto);
    });

    it('ควรปรับปรุง contract sub-category สำเร็จ', async () => {
      const mockDto = { subCatName: 'Updated Sub 3' };
      const mockResponse = { id: 3, subCatName: 'Updated Sub 3' };
      vi.mocked(apiClient.patch).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.updateContractSubCategory(3, mockDto);
      expect(result).toEqual(mockResponse);
      expect(apiClient.patch).toHaveBeenCalledWith('/drawings/master-data/contract/sub-categories/3', mockDto);
    });

    it('ควรลบ contract sub-category สำเร็จ', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({} as any);
      await drawingMasterDataService.deleteContractSubCategory(3);
      expect(apiClient.delete).toHaveBeenCalledWith('/drawings/master-data/contract/sub-categories/3');
    });
  });

  describe('Contract Category Mappings', () => {
    it('ควรดึงข้อมูล mappings สำเร็จ', async () => {
      const mockResponse = [{ id: 10, category: {}, subCategory: {} }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.getContractMappings('proj-uuid-1', 2);
      expect(result).toEqual(mockResponse);
      expect(apiClient.get).toHaveBeenCalledWith('/drawings/master-data/contract/mappings', {
        params: { projectId: 'proj-uuid-1', categoryId: 2 },
      });
    });

    it('ควรสร้าง mapping สำเร็จ', async () => {
      const mockDto = { projectId: 'proj-uuid-1', categoryId: 2, subCategoryId: 3 };
      const mockResponse = { id: 10 };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.createContractMapping(mockDto);
      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith('/drawings/master-data/contract/mappings', mockDto);
    });

    it('ควรลบ mapping สำเร็จ', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({} as any);
      await drawingMasterDataService.deleteContractMapping(10);
      expect(apiClient.delete).toHaveBeenCalledWith('/drawings/master-data/contract/mappings/10');
    });
  });

  describe('Shop Main Categories', () => {
    it('ควรดึงข้อมูล shop main categories สำเร็จ', async () => {
      const mockResponse = [{ id: 4, mainCategoryCode: 'M4', mainCategoryName: 'Main 4' }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.getShopMainCategories('proj-uuid-1');
      expect(result).toEqual(mockResponse);
      expect(apiClient.get).toHaveBeenCalledWith('/drawings/master-data/shop/main-categories', {
        params: { projectId: 'proj-uuid-1' },
      });
    });

    it('ควรสร้าง shop main category สำเร็จ', async () => {
      const mockDto = { projectId: 'proj-uuid-1', mainCategoryCode: 'M4', mainCategoryName: 'Main 4', sortOrder: 1 };
      const mockResponse = { id: 4, mainCategoryCode: 'M4' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.createShopMainCategory(mockDto);
      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith('/drawings/master-data/shop/main-categories', mockDto);
    });

    it('ควรปรับปรุง shop main category สำเร็จ', async () => {
      const mockDto = { mainCategoryName: 'Updated Main 4' };
      const mockResponse = { id: 4, mainCategoryName: 'Updated Main 4' };
      vi.mocked(apiClient.patch).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.updateShopMainCategory(4, mockDto);
      expect(result).toEqual(mockResponse);
      expect(apiClient.patch).toHaveBeenCalledWith('/drawings/master-data/shop/main-categories/4', mockDto);
    });

    it('ควรลบ shop main category สำเร็จ', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({} as any);
      await drawingMasterDataService.deleteShopMainCategory(4);
      expect(apiClient.delete).toHaveBeenCalledWith('/drawings/master-data/shop/main-categories/4');
    });
  });

  describe('Shop Sub-categories', () => {
    it('ควรดึงข้อมูล shop sub-categories สำเร็จ', async () => {
      const mockResponse = [{ id: 5, subCategoryCode: 'S5', subCategoryName: 'Sub 5' }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.getShopSubCategories('proj-uuid-1', 4);
      expect(result).toEqual(mockResponse);
      expect(apiClient.get).toHaveBeenCalledWith('/drawings/master-data/shop/sub-categories', {
        params: { projectId: 'proj-uuid-1', mainCategoryId: 4 },
      });
    });

    it('ควรสร้าง shop sub-category สำเร็จ', async () => {
      const mockDto = { projectId: 'proj-uuid-1', subCategoryCode: 'S5', subCategoryName: 'Sub 5', sortOrder: 1 };
      const mockResponse = { id: 5, subCategoryCode: 'S5' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.createShopSubCategory(mockDto);
      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith('/drawings/master-data/shop/sub-categories', mockDto);
    });

    it('ควรปรับปรุง shop sub-category สำเร็จ', async () => {
      const mockDto = { subCategoryName: 'Updated Sub 5' };
      const mockResponse = { id: 5, subCategoryName: 'Updated Sub 5' };
      vi.mocked(apiClient.patch).mockResolvedValue({ data: mockResponse });
      const result = await drawingMasterDataService.updateShopSubCategory(5, mockDto);
      expect(result).toEqual(mockResponse);
      expect(apiClient.patch).toHaveBeenCalledWith('/drawings/master-data/shop/sub-categories/5', mockDto);
    });

    it('ควรลบ shop sub-category สำเร็จ', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({} as any);
      await drawingMasterDataService.deleteShopSubCategory(5);
      expect(apiClient.delete).toHaveBeenCalledWith('/drawings/master-data/shop/sub-categories/5');
    });
  });
});
