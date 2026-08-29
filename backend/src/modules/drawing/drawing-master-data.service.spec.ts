// File: src/modules/drawing/drawing-master-data.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ DrawingMasterDataService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DrawingMasterDataService } from './drawing-master-data.service';
import { ContractDrawingVolume } from './entities/contract-drawing-volume.entity';
import { ContractDrawingCategory } from './entities/contract-drawing-category.entity';
import { ContractDrawingSubCategory } from './entities/contract-drawing-sub-category.entity';
import { ShopDrawingMainCategory } from './entities/shop-drawing-main-category.entity';
import { ShopDrawingSubCategory } from './entities/shop-drawing-sub-category.entity';
import { ContractDrawingSubcatCatMap } from './entities/contract-drawing-subcat-cat-map.entity';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';

describe('DrawingMasterDataService', () => {
  let service: DrawingMasterDataService;

  const makeMockRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  });

  const mockCdVolumeRepo = makeMockRepo();
  const mockCdCatRepo = makeMockRepo();
  const mockCdSubCatRepo = makeMockRepo();
  const mockSdMainCatRepo = makeMockRepo();
  const mockSdSubCatRepo = makeMockRepo();
  const mockCdMapRepo = makeMockRepo();

  const mockUuidResolver = {
    resolveProjectId: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrawingMasterDataService,
        {
          provide: getRepositoryToken(ContractDrawingVolume),
          useValue: mockCdVolumeRepo,
        },
        {
          provide: getRepositoryToken(ContractDrawingCategory),
          useValue: mockCdCatRepo,
        },
        {
          provide: getRepositoryToken(ContractDrawingSubCategory),
          useValue: mockCdSubCatRepo,
        },
        {
          provide: getRepositoryToken(ShopDrawingMainCategory),
          useValue: mockSdMainCatRepo,
        },
        {
          provide: getRepositoryToken(ShopDrawingSubCategory),
          useValue: mockSdSubCatRepo,
        },
        {
          provide: getRepositoryToken(ContractDrawingSubcatCatMap),
          useValue: mockCdMapRepo,
        },
        {
          provide: UuidResolverService,
          useValue: mockUuidResolver,
        },
      ],
    }).compile();

    service = module.get<DrawingMasterDataService>(DrawingMasterDataService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =====================================================
  // Volumes
  // =====================================================
  describe('Volumes', () => {
    it('findAllVolumes ควรคืน volumes ตาม projectId', async () => {
      const volumes = [{ id: 1, volumeCode: 'V1' }];
      mockCdVolumeRepo.find.mockResolvedValue(volumes);

      const result = await service.findAllVolumes('uuid-proj-1');

      expect(mockUuidResolver.resolveProjectId).toHaveBeenCalledWith(
        'uuid-proj-1'
      );
      expect(mockCdVolumeRepo.find).toHaveBeenCalledWith({
        where: { projectId: 1 },
        order: { sortOrder: 'ASC' },
      });
      expect(result).toEqual(volumes);
    });

    it('createVolume ควรสร้าง volume ใหม่', async () => {
      const created = { id: 1, volumeCode: 'V1', projectId: 1 };
      mockCdVolumeRepo.create.mockReturnValue(created);
      mockCdVolumeRepo.save.mockResolvedValue(created);

      const result = await service.createVolume({
        projectId: 'uuid-proj-1',
        volumeCode: 'V1',
        volumeName: 'Volume 1',
      });

      expect(mockCdVolumeRepo.create).toHaveBeenCalledWith({
        projectId: 'uuid-proj-1',
        volumeCode: 'V1',
        volumeName: 'Volume 1',
        projectId: 1,
      });
      expect(result).toEqual(created);
    });

    it('updateVolume ควรอัปเดต volume ที่มีอยู่', async () => {
      const volume = { id: 1, volumeCode: 'V1' };
      mockCdVolumeRepo.findOne.mockResolvedValue(volume);
      mockCdVolumeRepo.save.mockResolvedValue({ ...volume, volumeCode: 'V2' });

      const result = await service.updateVolume(1, { volumeCode: 'V2' });

      expect(result.volumeCode).toBe('V2');
    });

    it('updateVolume ควร throw NotFoundException เมื่อไม่พบ', async () => {
      mockCdVolumeRepo.findOne.mockResolvedValue(null);

      await expect(service.updateVolume(999, {})).rejects.toThrow(
        NotFoundException
      );
    });

    it('deleteVolume ควรลบ volume ได้', async () => {
      mockCdVolumeRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteVolume(1);

      expect(result).toEqual({ deleted: true });
    });

    it('deleteVolume ควร throw NotFoundException เมื่อ affected = 0', async () => {
      mockCdVolumeRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteVolume(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // =====================================================
  // Categories
  // =====================================================
  describe('Categories', () => {
    it('findAllCategories ควรคืน categories ตาม projectId', async () => {
      const cats = [{ id: 1 }];
      mockCdCatRepo.find.mockResolvedValue(cats);

      const result = await service.findAllCategories('uuid-proj-1');

      expect(result).toEqual(cats);
    });

    it('createCategory ควรสร้าง category ใหม่', async () => {
      const created = { id: 1, categoryCode: 'C1', projectId: 1 };
      mockCdCatRepo.create.mockReturnValue(created);
      mockCdCatRepo.save.mockResolvedValue(created);

      const result = await service.createCategory({
        projectId: 'uuid-proj-1',
        categoryCode: 'C1',
      });

      expect(result).toEqual(created);
    });

    it('updateCategory ควรอัปเดต category', async () => {
      const cat = { id: 1, categoryCode: 'C1' };
      mockCdCatRepo.findOne.mockResolvedValue(cat);
      mockCdCatRepo.save.mockResolvedValue({ ...cat, categoryCode: 'C2' });

      const result = await service.updateCategory(1, {
        categoryCode: 'C2',
      });

      expect(result.categoryCode).toBe('C2');
    });

    it('updateCategory ควร throw NotFoundException เมื่อไม่พบ', async () => {
      mockCdCatRepo.findOne.mockResolvedValue(null);

      await expect(service.updateCategory(999, {})).rejects.toThrow(
        NotFoundException
      );
    });

    it('deleteCategory ควรลบ category ได้', async () => {
      mockCdCatRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteCategory(1);

      expect(result).toEqual({ deleted: true });
    });

    it('deleteCategory ควร throw NotFoundException เมื่อ affected = 0', async () => {
      mockCdCatRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteCategory(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // =====================================================
  // Contract Sub-Categories
  // =====================================================
  describe('Contract Sub-Categories', () => {
    it('findAllContractSubCats ควรคืน sub-cats', async () => {
      const subCats = [{ id: 1 }];
      mockCdSubCatRepo.find.mockResolvedValue(subCats);

      const result = await service.findAllContractSubCats('uuid-proj-1');

      expect(result).toEqual(subCats);
    });

    it('createContractSubCat ควรสร้าง sub-cat', async () => {
      const created = { id: 1, projectId: 1 };
      mockCdSubCatRepo.create.mockReturnValue(created);
      mockCdSubCatRepo.save.mockResolvedValue(created);

      const result = await service.createContractSubCat({
        projectId: 'uuid-proj-1',
        subCategoryCode: 'S1',
      });

      expect(result).toEqual(created);
    });

    it('updateContractSubCat ควรอัปเดต sub-cat', async () => {
      const subCat = { id: 1, subCategoryCode: 'S1' };
      mockCdSubCatRepo.findOne.mockResolvedValue(subCat);
      mockCdSubCatRepo.save.mockResolvedValue({
        ...subCat,
        subCategoryCode: 'S2',
      });

      const result = await service.updateContractSubCat(1, {
        subCategoryCode: 'S2',
      });

      expect(result.subCategoryCode).toBe('S2');
    });

    it('updateContractSubCat ควร throw NotFoundException', async () => {
      mockCdSubCatRepo.findOne.mockResolvedValue(null);

      await expect(service.updateContractSubCat(999, {})).rejects.toThrow(
        NotFoundException
      );
    });

    it('deleteContractSubCat ควรลบ sub-cat', async () => {
      mockCdSubCatRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteContractSubCat(1);

      expect(result).toEqual({ deleted: true });
    });

    it('deleteContractSubCat ควร throw NotFoundException เมื่อ affected = 0', async () => {
      mockCdSubCatRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteContractSubCat(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // =====================================================
  // Contract Mappings
  // =====================================================
  describe('Contract Mappings', () => {
    it('findContractMappings ควรคืน mappings ทั้งหมดของ project', async () => {
      const mappings = [{ id: 1 }];
      mockCdMapRepo.find.mockResolvedValue(mappings);

      const result = await service.findContractMappings('uuid-proj-1');

      expect(mockCdMapRepo.find).toHaveBeenCalledWith({
        where: { projectId: 1 },
        relations: ['subCategory', 'category'],
        order: { id: 'ASC' },
      });
      expect(result).toEqual(mappings);
    });

    it('findContractMappings ควรกรองด้วย categoryId เมื่อส่งมา', async () => {
      const mappings = [{ id: 1 }];
      mockCdMapRepo.find.mockResolvedValue(mappings);

      await service.findContractMappings('uuid-proj-1', 5);

      expect(mockCdMapRepo.find).toHaveBeenCalledWith({
        where: { projectId: 1, categoryId: 5 },
        relations: ['subCategory', 'category'],
        order: { id: 'ASC' },
      });
    });

    it('createContractMapping ควรสร้าง mapping ใหม่', async () => {
      mockCdMapRepo.findOne.mockResolvedValue(null);
      const created = { id: 1, projectId: 1 };
      mockCdMapRepo.create.mockReturnValue(created);
      mockCdMapRepo.save.mockResolvedValue(created);

      const result = await service.createContractMapping({
        projectId: 'uuid-proj-1',
        categoryId: 5,
        subCategoryId: 10,
      });

      expect(result).toEqual(created);
    });

    it('createContractMapping ควรคืน existing mapping ถ้ามีอยู่แล้ว', async () => {
      const existing = {
        id: 1,
        projectId: 1,
        categoryId: 5,
        subCategoryId: 10,
      };
      mockCdMapRepo.findOne.mockResolvedValue(existing);

      const result = await service.createContractMapping({
        projectId: 'uuid-proj-1',
        categoryId: 5,
        subCategoryId: 10,
      });

      expect(result).toEqual(existing);
      expect(mockCdMapRepo.create).not.toHaveBeenCalled();
    });

    it('deleteContractMapping ควรลบ mapping', async () => {
      mockCdMapRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteContractMapping(1);

      expect(result).toEqual({ deleted: true });
    });

    it('deleteContractMapping ควร throw NotFoundException เมื่อ affected = 0', async () => {
      mockCdMapRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteContractMapping(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // =====================================================
  // Shop Drawing Main Categories
  // =====================================================
  describe('Shop Main Categories', () => {
    it('findAllShopMainCats ควรคืน main cats', async () => {
      const cats = [{ id: 1 }];
      mockSdMainCatRepo.find.mockResolvedValue(cats);

      const result = await service.findAllShopMainCats('uuid-proj-1');

      expect(result).toEqual(cats);
    });

    it('createShopMainCat ควรสร้าง main cat', async () => {
      const created = { id: 1, projectId: 1 };
      mockSdMainCatRepo.create.mockReturnValue(created);
      mockSdMainCatRepo.save.mockResolvedValue(created);

      const result = await service.createShopMainCat({
        projectId: 'uuid-proj-1',
        mainCategoryCode: 'M1',
      });

      expect(result).toEqual(created);
    });

    it('updateShopMainCat ควรอัปเดต main cat', async () => {
      const cat = { id: 1, mainCategoryCode: 'M1' };
      mockSdMainCatRepo.findOne.mockResolvedValue(cat);
      mockSdMainCatRepo.save.mockResolvedValue({
        ...cat,
        mainCategoryCode: 'M2',
      });

      const result = await service.updateShopMainCat(1, {
        mainCategoryCode: 'M2',
      });

      expect(result.mainCategoryCode).toBe('M2');
    });

    it('updateShopMainCat ควร throw NotFoundException', async () => {
      mockSdMainCatRepo.findOne.mockResolvedValue(null);

      await expect(service.updateShopMainCat(999, {})).rejects.toThrow(
        NotFoundException
      );
    });

    it('deleteShopMainCat ควรลบ main cat', async () => {
      mockSdMainCatRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteShopMainCat(1);

      expect(result).toEqual({ deleted: true });
    });

    it('deleteShopMainCat ควร throw NotFoundException เมื่อ affected = 0', async () => {
      mockSdMainCatRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteShopMainCat(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // =====================================================
  // Shop Drawing Sub-Categories
  // =====================================================
  describe('Shop Sub-Categories', () => {
    it('findAllShopSubCats ควรคืน sub-cats ทั้งหมดของ project', async () => {
      const subCats = [{ id: 1 }];
      mockSdSubCatRepo.find.mockResolvedValue(subCats);

      const result = await service.findAllShopSubCats('uuid-proj-1');

      expect(mockSdSubCatRepo.find).toHaveBeenCalledWith({
        where: { projectId: 1 },
        order: { sortOrder: 'ASC' },
      });
      expect(result).toEqual(subCats);
    });

    it('findAllShopSubCats ควรกรองด้วย mainCategoryId', async () => {
      const subCats = [{ id: 1 }];
      mockSdSubCatRepo.find.mockResolvedValue(subCats);

      await service.findAllShopSubCats('uuid-proj-1', 5);

      expect(mockSdSubCatRepo.find).toHaveBeenCalledWith({
        where: { projectId: 1, mainCategoryId: 5 },
        order: { sortOrder: 'ASC' },
      });
    });

    it('createShopSubCat ควรสร้าง sub-cat', async () => {
      const created = { id: 1, projectId: 1 };
      mockSdSubCatRepo.create.mockReturnValue(created);
      mockSdSubCatRepo.save.mockResolvedValue(created);

      const result = await service.createShopSubCat({
        projectId: 'uuid-proj-1',
        subCategoryCode: 'S1',
      });

      expect(result).toEqual(created);
    });

    it('updateShopSubCat ควรอัปเดต sub-cat', async () => {
      const subCat = { id: 1, subCategoryCode: 'S1' };
      mockSdSubCatRepo.findOne.mockResolvedValue(subCat);
      mockSdSubCatRepo.save.mockResolvedValue({
        ...subCat,
        subCategoryCode: 'S2',
      });

      const result = await service.updateShopSubCat(1, {
        subCategoryCode: 'S2',
      });

      expect(result.subCategoryCode).toBe('S2');
    });

    it('updateShopSubCat ควร throw NotFoundException', async () => {
      mockSdSubCatRepo.findOne.mockResolvedValue(null);

      await expect(service.updateShopSubCat(999, {})).rejects.toThrow(
        NotFoundException
      );
    });

    it('deleteShopSubCat ควรลบ sub-cat', async () => {
      mockSdSubCatRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteShopSubCat(1);

      expect(result).toEqual({ deleted: true });
    });

    it('deleteShopSubCat ควร throw NotFoundException เมื่อ affected = 0', async () => {
      mockSdSubCatRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteShopSubCat(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
