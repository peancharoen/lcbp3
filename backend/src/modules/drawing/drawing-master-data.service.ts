import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';

// Entities
import { ContractDrawingVolume } from './entities/contract-drawing-volume.entity';
import { ContractDrawingCategory } from './entities/contract-drawing-category.entity';
import { ContractDrawingSubCategory } from './entities/contract-drawing-sub-category.entity';
import { ShopDrawingMainCategory } from './entities/shop-drawing-main-category.entity';
import { ShopDrawingSubCategory } from './entities/shop-drawing-sub-category.entity';
import { ContractDrawingSubcatCatMap } from './entities/contract-drawing-subcat-cat-map.entity';

@Injectable()
export class DrawingMasterDataService {
  constructor(
    @InjectRepository(ContractDrawingVolume)
    private cdVolumeRepo: Repository<ContractDrawingVolume>,
    @InjectRepository(ContractDrawingCategory)
    private cdCatRepo: Repository<ContractDrawingCategory>,
    @InjectRepository(ContractDrawingSubCategory)
    private cdSubCatRepo: Repository<ContractDrawingSubCategory>,
    @InjectRepository(ShopDrawingMainCategory)
    private sdMainCatRepo: Repository<ShopDrawingMainCategory>,
    @InjectRepository(ShopDrawingSubCategory)
    private sdSubCatRepo: Repository<ShopDrawingSubCategory>,
    @InjectRepository(ContractDrawingSubcatCatMap)
    private cdMapRepo: Repository<ContractDrawingSubcatCatMap>
  ) {}

  // =====================================================
  // Contract Drawing Volumes
  // =====================================================

  async findAllVolumes(projectId: number) {
    return this.cdVolumeRepo.find({
      where: { projectId },
      order: { sortOrder: 'ASC' },
    });
  }

  async createVolume(data: Partial<ContractDrawingVolume>) {
    const volume = this.cdVolumeRepo.create(data);
    return this.cdVolumeRepo.save(volume);
  }

  async updateVolume(id: number, data: Partial<ContractDrawingVolume>) {
    const volume = await this.cdVolumeRepo.findOne({ where: { id } });
    if (!volume) throw new NotFoundException(`Volume #${id} not found`);
    Object.assign(volume, data);
    return this.cdVolumeRepo.save(volume);
  }

  async deleteVolume(id: number) {
    const result = await this.cdVolumeRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Volume #${id} not found`);
    return { deleted: true };
  }

  // =====================================================
  // Contract Drawing Categories
  // =====================================================

  async findAllCategories(projectId: number) {
    return this.cdCatRepo.find({
      where: { projectId },
      order: { sortOrder: 'ASC' },
    });
  }

  async createCategory(data: Partial<ContractDrawingCategory>) {
    const cat = this.cdCatRepo.create(data);
    return this.cdCatRepo.save(cat);
  }

  async updateCategory(id: number, data: Partial<ContractDrawingCategory>) {
    const cat = await this.cdCatRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException(`Category #${id} not found`);
    Object.assign(cat, data);
    return this.cdCatRepo.save(cat);
  }

  async deleteCategory(id: number) {
    const result = await this.cdCatRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Category #${id} not found`);
    return { deleted: true };
  }

  // =====================================================
  // Contract Drawing Sub-Categories
  // =====================================================

  async findAllContractSubCats(projectId: number) {
    return this.cdSubCatRepo.find({
      where: { projectId },
      order: { sortOrder: 'ASC' },
    });
  }

  async createContractSubCat(data: Partial<ContractDrawingSubCategory>) {
    const subCat = this.cdSubCatRepo.create(data);
    return this.cdSubCatRepo.save(subCat);
  }

  async updateContractSubCat(
    id: number,
    data: Partial<ContractDrawingSubCategory>
  ) {
    const subCat = await this.cdSubCatRepo.findOne({ where: { id } });
    if (!subCat) throw new NotFoundException(`Sub-Category #${id} not found`);
    Object.assign(subCat, data);
    return this.cdSubCatRepo.save(subCat);
  }

  async deleteContractSubCat(id: number) {
    const result = await this.cdSubCatRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Sub-Category #${id} not found`);
    return { deleted: true };
  }

  // =====================================================
  // Contract Drawing Mappings (Category <-> Sub-Category)
  // =====================================================

  async findContractMappings(projectId: number, categoryId?: number) {
    const where: FindOptionsWhere<ContractDrawingSubcatCatMap> = { projectId };
    if (categoryId) {
      where.categoryId = categoryId;
    }
    return this.cdMapRepo.find({
      where,
      relations: ['subCategory', 'category'],
      order: { id: 'ASC' },
    });
  }

  async createContractMapping(data: {
    projectId: number;
    categoryId: number;
    subCategoryId: number;
  }) {
    // Check if mapping already exists to prevent duplicates (though DB has UNIQUE constraint)
    const existing = await this.cdMapRepo.findOne({
      where: {
        projectId: data.projectId,
        categoryId: data.categoryId,
        subCategoryId: data.subCategoryId,
      },
    });

    if (existing) return existing;

    const map = this.cdMapRepo.create(data);
    return this.cdMapRepo.save(map);
  }

  async deleteContractMapping(id: number) {
    const result = await this.cdMapRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Mapping #${id} not found`);
    return { deleted: true };
  }

  // =====================================================
  // Shop Drawing Main Categories
  // =====================================================

  async findAllShopMainCats(projectId: number) {
    return this.sdMainCatRepo.find({
      where: { projectId },
      order: { sortOrder: 'ASC' },
    });
  }

  async createShopMainCat(data: Partial<ShopDrawingMainCategory>) {
    const cat = this.sdMainCatRepo.create(data);
    return this.sdMainCatRepo.save(cat);
  }

  async updateShopMainCat(id: number, data: Partial<ShopDrawingMainCategory>) {
    const cat = await this.sdMainCatRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException(`Main Category #${id} not found`);
    Object.assign(cat, data);
    return this.sdMainCatRepo.save(cat);
  }

  async deleteShopMainCat(id: number) {
    const result = await this.sdMainCatRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Main Category #${id} not found`);
    return { deleted: true };
  }

  // =====================================================
  // Shop Drawing Sub-Categories
  // =====================================================

  async findAllShopSubCats(projectId: number, mainCategoryId?: number) {
    const where: FindOptionsWhere<ShopDrawingSubCategory> = {
      projectId,
      ...(mainCategoryId ? { mainCategoryId } : {}),
    };

    return this.sdSubCatRepo.find({
      where,
      order: { sortOrder: 'ASC' },
    });
  }

  async createShopSubCat(data: Partial<ShopDrawingSubCategory>) {
    const subCat = this.sdSubCatRepo.create(data);
    return this.sdSubCatRepo.save(subCat);
  }

  async updateShopSubCat(id: number, data: Partial<ShopDrawingSubCategory>) {
    const subCat = await this.sdSubCatRepo.findOne({ where: { id } });
    if (!subCat) throw new NotFoundException(`Sub-Category #${id} not found`);
    Object.assign(subCat, data);
    return this.sdSubCatRepo.save(subCat);
  }

  async deleteShopSubCat(id: number) {
    const result = await this.sdSubCatRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Sub-Category #${id} not found`);
    return { deleted: true };
  }
}
