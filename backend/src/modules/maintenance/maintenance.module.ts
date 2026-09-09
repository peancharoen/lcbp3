// File: backend/src/modules/maintenance/maintenance.module.ts
// Change Log:
// - 2026-09-07: Maintenance Console module (Feature 253 — T092)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { NumberingToolsService } from './services/numbering-tools.service';
import { OrphanCleanupService } from './services/orphan-cleanup.service';
import { VectorSyncService } from './services/vector-sync.service';
import { EmergencyUnlockService } from './services/emergency-unlock.service';
import { CommonModule } from '../../common/common.module';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { AiModule } from '../ai/ai.module';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { UserModule } from '../user/user.module';

/**
 * Module สำหรับ System Admin Maintenance Console
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    CommonModule,
    FileStorageModule,
    AiModule,
    DocumentNumberingModule,
    UserModule, // สำหรับ RbacGuard (ต้องการ UserService) — ADR-016/security fix 2026-09-09
  ],
  controllers: [MaintenanceController],
  providers: [
    MaintenanceService,
    NumberingToolsService,
    OrphanCleanupService,
    VectorSyncService,
    EmergencyUnlockService,
  ],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
