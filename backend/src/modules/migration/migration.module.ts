// File: src/modules/migration/migration.module.ts
// Change Log:
// - 2026-05-22: นำเข้าและลงทะเบียน ExpirePendingReviewsWorker (T016b), Attachment, User, และ NotificationModule เพื่อรองรับระบบยกเลิกรีวิวที่หมดอายุ

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { NotificationModule } from '../notification/notification.module';

import { MigrationReviewQueue } from './entities/migration-review-queue.entity';
import { MigrationError } from './entities/migration-error.entity';
import { ExpirePendingReviewsWorker } from './workers/expire-pending-reviews.worker';

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
    ]),
    FileStorageModule,
    NotificationModule,
  ],
  controllers: [MigrationController, MigrationReviewController],
  providers: [
    MigrationService,
    MigrationReviewService,
    ExpirePendingReviewsWorker,
  ],
  exports: [MigrationService, MigrationReviewService],
})
export class MigrationModule {}
