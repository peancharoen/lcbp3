import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';

// Entities
import { ContractDrawingVolume } from './entities/contract-drawing-volume.entity';
import { ContractDrawingSubCategory } from './entities/contract-drawing-sub-category.entity';
import { ShopDrawingMainCategory } from './entities/shop-drawing-main-category.entity';
import { ShopDrawingSubCategory } from './entities/shop-drawing-sub-category.entity';

@Injectable()
export class DrawingMasterDataService {
  constructor(
    @InjectRepository(ContractDrawingVolume)
    private cdVolumeRepo: Repository<ContractDrawingVolume>,
    @InjectRepository(ContractDrawingSubCategory)
    private cdSubCatRepo: Repository<ContractDrawingSubCategory>,
    @InjectRepository(ShopDrawingMainCategory)
    private sdMainCatRepo: Repository<ShopDrawingMainCategory>,
    @InjectRepository(ShopDrawingSubCategory)
    private sdSubCatRepo: Repository<ShopDrawingSubCategory>,
  ) {}

  // --- Contract Drawing Volumes ---
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

  // --- Contract Drawing Sub-Categories ---
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

  // --- Shop Drawing Main Categories ---
  async findAllShopMainCats() {
    return this.sdMainCatRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  // --- Shop Drawing Sub Categories ---
  async findAllShopSubCats(mainCategoryId?: number) {
    // ✅ FIX: ใช้วิธี Spread Operator เพื่อสร้าง Object เงื่อนไขที่ถูกต้องตาม Type
    const where: FindOptionsWhere<ShopDrawingSubCategory> = {
      isActive: true,
      ...(mainCategoryId ? { mainCategoryId } : {}),
    };

    return this.sdSubCatRepo.find({
      where,
      order: { sortOrder: 'ASC' },
      relations: ['mainCategory'], // Load Parent Info
    });
  }
}
