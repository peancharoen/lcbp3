// File: backend/src/modules/migration/migration.module.ts
// Change Log:
// - 2026-05-22: นำเข้าและลงทะทะเบียน ExpirePendingReviewsWorker (T016b), Attachment, User, และ NotificationModule เพื่อรองรับระบบยกเลิกรีวิวที่หมดอายุ
// - 2026-05-22: เพิ่ม CaslModule import เพื่อแก้ไข PermissionsGuard dependency (AbilityFactory)
// - 2026-08-06: เพิ่ม SystemSetting, RedisModule, ReviewThresholdService, MetadataResolutionService, RagBatchService สำหรับ Feature 242

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import { MigrationReviewController } from './migration-review.controller';
import { MigrationReviewService } from './migration-review.service';
import { ImportTransaction } from './entities/import-transaction.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { Project } from '../project/entities/project.entity';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { CaslModule } from '../../common/auth/casl/casl.module';
import { SystemSetting } from '../ai/entities/system-setting.entity';

import { MigrationReviewQueue } from './entities/migration-review-queue.entity';
import { MigrationError } from './entities/migration-error.entity';
import { ExpirePendingReviewsWorker } from './workers/expire-pending-reviews.worker';
import { ReviewThresholdService } from './services/review-threshold.service';
import { MetadataResolutionService } from './services/metadata-resolution.service';
import { RagBatchService } from './services/rag-batch.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImportTransaction,
      MigrationReviewQueue,
      MigrationError,
      Correspondence,
      CorrespondenceRevision,
      CorrespondenceType,
      CorrespondenceStatus,
      Project,
      Attachment,
      User,
      SystemSetting,
    ]),
    FileStorageModule,
    NotificationModule,
    CaslModule,
    RedisModule,
    UserModule, // สำหรับ RbacGuard (ต้องการ UserService)
  ],
  controllers: [MigrationController, MigrationReviewController],
  providers: [
    MigrationService,
    MigrationReviewService,
    ExpirePendingReviewsWorker,
    ReviewThresholdService,
    MetadataResolutionService,
    RagBatchService,
  ],
  exports: [
    MigrationService,
    MigrationReviewService,
    ReviewThresholdService,
    MetadataResolutionService,
    RagBatchService,
  ],
})
export class MigrationModule {}
