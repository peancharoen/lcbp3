import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities (Main)
import { ContractDrawing } from './entities/contract-drawing.entity';
import { ShopDrawing } from './entities/shop-drawing.entity';
import { ShopDrawingRevision } from './entities/shop-drawing-revision.entity';

// Entities (Master Data - Contract Drawing)
import { ContractDrawingVolume } from './entities/contract-drawing-volume.entity';
import { ContractDrawingSubCategory } from './entities/contract-drawing-sub-category.entity';

// Entities (Master Data - Shop Drawing) - ✅ เพิ่มใหม่
import { ShopDrawingMainCategory } from './entities/shop-drawing-main-category.entity';
import { ShopDrawingSubCategory } from './entities/shop-drawing-sub-category.entity';

// Common Entities
import { Attachment } from '../../common/file-storage/entities/attachment.entity';

// Services
import { ShopDrawingService } from './shop-drawing.service';
import { ContractDrawingService } from './contract-drawing.service';
import { DrawingMasterDataService } from './drawing-master-data.service'; // ✅ New

// Controllers
import { ShopDrawingController } from './shop-drawing.controller';
import { ContractDrawingController } from './contract-drawing.controller';
import { DrawingMasterDataController } from './drawing-master-data.controller';
// Modules
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { UserModule } from '../user/user.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Main
      ContractDrawing,
      ShopDrawing,
      ShopDrawingRevision,

      // Master Data
      ContractDrawingVolume,
      ContractDrawingSubCategory,
      ShopDrawingMainCategory, // ✅
      ShopDrawingSubCategory, // ✅

      // Common
      Attachment,
    ]),
    FileStorageModule,
    UserModule,
  ],
  providers: [
    ShopDrawingService,
    ContractDrawingService,
    DrawingMasterDataService,
  ],
  controllers: [
    ShopDrawingController,
    ContractDrawingController,
    DrawingMasterDataController,
  ],
  exports: [ShopDrawingService, ContractDrawingService],
})
export class DrawingModule {}
