// File: backend/src/modules/migration/migration.module.ts
// Change Log:
// - 2026-05-22: นำเข้าและลงทะทะเบียน ExpirePendingReviewsWorker (T016b), Attachment, User, และ NotificationModule เพื่อรองรับระบบยกเลิกรีวิวที่หมดอายุ
// - 2026-05-22: เพิ่ม CaslModule import เพื่อแก้ไข PermissionsGuard dependency (AbilityFactory)
// - 2026-08-06: เพิ่ม SystemSetting, RedisModule, ReviewThresholdService, MetadataResolutionService, RagBatchService สำหรับ Feature 242
// - 2026-08-20: เพิ่ม LegacyIngestionService, MigrationProgress, Organization, และ BullModule ai-batch (ADR-047)
// - 2026-09-06: เพิ่ม Excel Import Review Pipeline services + controller (ADR-052, Wave 3)
//   ExcelDateParserService, ReviewSessionStashService, ExcelRowBuilderService,
//   ExcelSchemaValidatorService, ExcelBusinessRulesService, ExcelDataReviewService,
//   ExcelImportReviewController + Discipline entity

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bullmq';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import { MigrationReviewController } from './migration-review.controller';
import { MigrationReviewService } from './migration-review.service';
import { ExcelImportReviewController } from './excel-import-review.controller';
import { ImportTransaction } from './entities/import-transaction.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Discipline } from '../master/entities/discipline.entity';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { CaslModule } from '../../common/auth/casl/casl.module';
import { SystemSetting } from '../ai/entities/system-setting.entity';

import { MigrationReviewQueue } from './entities/migration-review-queue.entity';
import { MigrationProgress } from '../ai/entities/migration-progress.entity';
import { MigrationError } from './entities/migration-error.entity';
import { ExpirePendingReviewsWorker } from './workers/expire-pending-reviews.worker';
import { CleanExpiredStashesWorker } from './workers/clean-expired-stashes.worker';
import { ReviewThresholdService } from './services/review-threshold.service';
import { MetadataResolutionService } from './services/metadata-resolution.service';
import { RagBatchService } from './services/rag-batch.service';
import { LegacyIngestionService } from './services/legacy-ingestion.service';
import { ExcelDateParserService } from './services/excel-date-parser.service';
import {
  ReviewSessionStashService,
  REVIEW_STAGING_ROOT_TOKEN,
} from './services/review-session-stash.service';
import { ExcelRowBuilderService } from './services/excel-row-builder.service';
import { ExcelSchemaValidatorService } from './services/excel-schema-validator.service';
import { ExcelBusinessRulesService } from './services/excel-business-rules.service';
import { ExcelDataReviewService } from './services/excel-data-review.service';
import {
  AiReviewProviderFactory,
  AI_REVIEWER_ADAPTERS,
} from './services/ai-review-provider.factory';
import { LocalOllamaReviewAdapter } from './services/local-ollama-review.adapter';
import { ExcelAnnotatorService } from './services/excel-annotator.service';
import { ExcelQuarantineService } from './services/excel-quarantine.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImportTransaction,
      MigrationReviewQueue,
      MigrationProgress,
      MigrationError,
      Correspondence,
      CorrespondenceRevision,
      CorrespondenceType,
      CorrespondenceStatus,
      Project,
      Organization,
      Discipline,
      Attachment,
      User,
      SystemSetting,
    ]),
    BullModule.registerQueue({
      name: 'ai-batch',
    }),
    FileStorageModule,
    NotificationModule,
    CaslModule,
    RedisModule,
    UserModule, // สำหรับ RbacGuard + ExcelImportReviewController (ต้องการ UserService)
    AiModule, // สำหรับ OllamaService (Layer 3 AI Reviewer — ADR-023/023A)
  ],
  controllers: [
    MigrationController,
    MigrationReviewController,
    ExcelImportReviewController,
  ],
  providers: [
    MigrationService,
    MigrationReviewService,
    ExpirePendingReviewsWorker,
    CleanExpiredStashesWorker,
    ReviewThresholdService,
    MetadataResolutionService,
    RagBatchService,
    LegacyIngestionService,
    // Excel Import Review Pipeline (ADR-052)
    ExcelDateParserService,
    ReviewSessionStashService,
    ExcelRowBuilderService,
    ExcelSchemaValidatorService,
    ExcelBusinessRulesService,
    ExcelDataReviewService,
    // Layer 3 AI Reviewer (T012, FR-008, D2)
    LocalOllamaReviewAdapter,
    AiReviewProviderFactory,
    // AI_REVIEWER_ADAPTERS — array ของ adapter ที่ inject เข้า factory
    // เพิ่ม adapter ใหม่ที่นี่เมื่อรองรับ GEMINI/CLAUDE
    {
      provide: AI_REVIEWER_ADAPTERS,
      useFactory: (local: LocalOllamaReviewAdapter) => [local],
      inject: [LocalOllamaReviewAdapter],
    },
    // Annotator (T013, FR-010, D4)
    ExcelAnnotatorService,
    // Quarantine (T017, FR-015, D6)
    ExcelQuarantineService,
    // RbacGuard ต้องการ UserService จาก UserModule (resolve ใน module scope)
    RbacGuard,
    // REVIEW_STAGING_ROOT_TOKEN — root directory สำหรับ stash files
    {
      provide: REVIEW_STAGING_ROOT_TOKEN,
      useValue:
        process.env.REVIEW_STAGING_ROOT || 'uploads/import-review-staging',
    },
  ],
  exports: [
    MigrationService,
    MigrationReviewService,
    ReviewThresholdService,
    MetadataResolutionService,
    RagBatchService,
    LegacyIngestionService,
  ],
})
export class MigrationModule {}
