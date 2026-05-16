// File: src/modules/ai/ai.module.ts
// Change Log
// - 2026-05-14: เพิ่ม BullMQ/Qdrant/Service Account foundation สำหรับ ADR-023.
// - 2026-05-15: เพิ่ม ai-realtime/ai-batch foundation และ stale paused recovery ตาม ADR-023A.
// Module สำหรับ AI Gateway — ลงทะเบียน Services และ Controllers (ADR-023)

import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiIngestService } from './ai-ingest.service';
import { AiQueueService } from './ai-queue.service';
import { AiQdrantService } from './qdrant.service';
import { AiValidationService } from './ai-validation.service';
import { AiRagService } from './ai-rag.service';
import { AiRagProcessor } from './processors/rag.processor';
import { AiRealtimeProcessor } from './processors/ai-realtime.processor';
import { AiBatchProcessor } from './processors/ai-batch.processor';
import { AiVectorDeletionProcessor } from './processors/vector-deletion.processor';
import { OllamaService } from './services/ollama.service';
import { OcrService } from './services/ocr.service';
import { EmbeddingService } from './services/embedding.service';
import { MigrationLog } from './entities/migration-log.entity';
import { AiAuditLog } from './entities/ai-audit-log.entity';
import { MigrationReviewRecord } from './entities/migration-review.entity';
import { UserModule } from '../user/user.module';
import { MigrationModule } from '../migration/migration.module';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { RbacGuard } from '../../common/guards/rbac.guard';
import {
  QUEUE_AI_BATCH,
  QUEUE_AI_INGEST,
  QUEUE_AI_RAG,
  QUEUE_AI_REALTIME,
  QUEUE_AI_VECTOR_DELETION,
} from '../common/constants/queue.constants';

@Module({
  imports: [
    // Entities สำหรับ AI Module
    TypeOrmModule.forFeature([
      MigrationLog,
      AiAuditLog,
      AuditLog,
      MigrationReviewRecord,
      Attachment,
      Project,
      Organization,
      CorrespondenceType,
    ]),

    BullModule.registerQueue(
      { name: QUEUE_AI_INGEST },
      {
        name: QUEUE_AI_REALTIME,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      },
      {
        name: QUEUE_AI_BATCH,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
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
    AuditLogModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    AiIngestService,
    AiQueueService,
    AiQdrantService,
    AiValidationService,
    OllamaService,
    OcrService,
    EmbeddingService,
    AiRealtimeProcessor,
    AiBatchProcessor,
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
    OllamaService,
    OcrService,
    AiRagService,
  ],
})
export class AiModule implements OnModuleInit {
  private readonly logger = new Logger(AiModule.name);

  constructor(
    @InjectQueue(QUEUE_AI_REALTIME)
    private readonly aiRealtimeQueue: Queue,
    @InjectQueue(QUEUE_AI_BATCH)
    private readonly aiBatchQueue: Queue
  ) {}

  /** ป้องกัน ai-batch ค้าง paused หลัง service restart ระหว่าง ai-realtime job */
  async onModuleInit(): Promise<void> {
    const isPaused = await this.aiBatchQueue.isPaused();
    const activeCount = await this.aiRealtimeQueue.getActiveCount();
    if (isPaused && activeCount === 0) {
      await this.aiBatchQueue.resume();
      this.logger.warn('ai-batch auto-resumed on startup (stale paused state)');
    }
  }
}
