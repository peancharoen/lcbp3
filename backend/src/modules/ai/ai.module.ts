// File: src/modules/ai/ai.module.ts
// Change Log
// - 2026-05-14: เพิ่ม BullMQ/Qdrant/Service Account foundation สำหรับ ADR-023.
// Module สำหรับ AI Gateway — ลงทะเบียน Services และ Controllers (ADR-023)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiIngestService } from './ai-ingest.service';
import { AiQueueService } from './ai-queue.service';
import { AiQdrantService } from './qdrant.service';
import { AiValidationService } from './ai-validation.service';
import { AiRagService } from './ai-rag.service';
import { AiRagProcessor } from './processors/rag.processor';
import { AiVectorDeletionProcessor } from './processors/vector-deletion.processor';
import { MigrationLog } from './entities/migration-log.entity';
import { AiAuditLog } from './entities/ai-audit-log.entity';
import { MigrationReviewRecord } from './entities/migration-review.entity';
import { UserModule } from '../user/user.module';
import { MigrationModule } from '../migration/migration.module';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { RbacGuard } from '../../common/guards/rbac.guard';
import {
  QUEUE_AI_INGEST,
  QUEUE_AI_RAG,
  QUEUE_AI_VECTOR_DELETION,
} from '../common/constants/queue.constants';

@Module({
  imports: [
    // Entities สำหรับ AI Module
    TypeOrmModule.forFeature([
      MigrationLog,
      AiAuditLog,
      MigrationReviewRecord,
      Project,
      Organization,
      CorrespondenceType,
    ]),

    BullModule.registerQueue(
      { name: QUEUE_AI_INGEST },
      { name: QUEUE_AI_RAG },
      { name: QUEUE_AI_VECTOR_DELETION }
    ),

    // HTTP Client สำหรับเรียก n8n Webhook (ADR-018: AI สื่อสารผ่าน API)
    HttpModule.register({
      timeout: 35000, // เผื่อ timeout เกิน AI_TIMEOUT_MS เล็กน้อย
      maxRedirects: 3,
    }),

    // Config สำหรับ AI Env Vars
    ConfigModule,

    // UserModule สำหรับ RbacGuard (ต้องการ UserService)
    UserModule,
    MigrationModule,
    FileStorageModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    AiIngestService,
    AiQueueService,
    AiQdrantService,
    AiValidationService,
    // Phase 4: RAG BullMQ pipeline (ADR-023)
    AiRagService,
    AiRagProcessor,
    // Phase 5: Vector Deletion async processor (ADR-023 FR-008)
    AiVectorDeletionProcessor,
    // RbacGuard ต้องการ UserService จาก UserModule
    RbacGuard,
  ],
  exports: [
    AiService,
    AiIngestService,
    AiQueueService,
    AiQdrantService,
    AiValidationService,
    AiRagService,
  ],
})
export class AiModule {}
