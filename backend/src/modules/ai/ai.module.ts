// File: src/modules/ai/ai.module.ts
// Change Log
// - 2026-05-14: เพิ่ม BullMQ/Qdrant/Service Account foundation สำหรับ ADR-023.
// - 2026-05-15: เพิ่ม ai-realtime/ai-batch foundation และ stale paused recovery ตาม ADR-023A.
// - 2026-05-19: เพิ่ม IntentClassifierModule (ADR-024 Intent Classification).
// - 2026-05-19: เพิ่ม AiToolModule (ADR-025 AI Tool Layer).
// - 2026-05-21: ลงทะเบียน SystemSetting, AiSettingsService และ AiEnabledGuard สำหรับ ADR-027.
// - 2026-05-22: นำเข้าและลงทะเบียน CleanupTempFilesWorker (T016) เพื่อลบไฟล์แนบชั่วคราวหมดอายุ
// - 2026-05-23: ลงทะเบียน MigrationProgress + AiMigrationCheckpointService (ADR-023A)
// - 2026-05-25: ลงทะเบียน AiAvailableModel สำหรับ AI Model Management (ADR-027).
// - 2026-05-30: ลงทะเบียน VramMonitorService, OcrCacheService, NpDmsOcrProcessor, NpDmsAiProcessor (ADR-032).
// - 2026-06-13: ลงทะเบียน AiSandboxProfile สำหรับ ADR-036 sandbox-production parity
// Module สำหรับ AI Gateway — ลงทะเบียน Services และ Controllers (ADR-023)

import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { RedisModule } from '@nestjs-modules/ioredis';
import { Queue } from 'bullmq';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiSettingsService } from './ai-settings.service';
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
import { SandboxOcrEngineService } from './services/sandbox-ocr-engine.service';
import { EmbeddingService } from './services/embedding.service';
import { VramMonitorService } from './services/vram-monitor.service';
import { OcrCacheService } from './services/ocr-cache.service';
import { AiPolicyService } from './services/ai-policy.service';
import { MigrationLog } from './entities/migration-log.entity';
import { AiAuditLog } from './entities/ai-audit-log.entity';
import { MigrationReviewRecord } from './entities/migration-review.entity';
import { MigrationProgress } from './entities/migration-progress.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { AiAvailableModel } from './entities/ai-available-model.entity';
import { AiExecutionProfile } from './entities/ai-execution-profile.entity';
import { AiSandboxProfile } from './entities/ai-sandbox-profile.entity';
import { AiMigrationCheckpointService } from './ai-migration-checkpoint.service';
import { AiExecutionProfilesService } from './services/ai-execution-profiles.service';
import { AiEnabledGuard } from './guards/ai-enabled.guard';
import { UserModule } from '../user/user.module';
import { MigrationModule } from '../migration/migration.module';
import { TagsModule } from '../tags/tags.module';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { ImportTransaction } from '../migration/entities/import-transaction.entity';
import { MigrationReviewQueue } from '../migration/entities/migration-review-queue.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { IntentClassifierModule } from './intent-classifier/intent-classifier.module';
import { AiToolModule } from './tool/ai-tool.module';
import { CleanupTempFilesWorker } from './workers/cleanup-temp-files.worker';
import { AiPromptsModule } from './prompts/ai-prompts.module';
import { AiPrompt } from './prompts/ai-prompts.entity';
import {
  QUEUE_AI_BATCH,
  QUEUE_AI_INGEST,
  QUEUE_AI_RAG,
  QUEUE_AI_REALTIME,
  QUEUE_AI_VECTOR_DELETION,
} from '../common/constants/queue.constants';
import {
  NpDmsOcrProcessor,
  QUEUE_NP_DMS_OCR,
} from './processors/np-dms-ocr-processor';
import {
  NpDmsAiProcessor,
  QUEUE_NP_DMS_AI,
} from './processors/np-dms-ai.processor';

@Module({
  imports: [
    // Entities สำหรับ AI Module
    TypeOrmModule.forFeature([
      MigrationLog,
      AiAuditLog,
      AuditLog,
      MigrationReviewRecord,
      MigrationProgress,
      SystemSetting,
      AiAvailableModel,
      Attachment,
      Project,
      Organization,
      CorrespondenceType,
      ImportTransaction,
      MigrationReviewQueue,
      AiPrompt,
      AiExecutionProfile,
      AiSandboxProfile,
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
      { name: QUEUE_AI_VECTOR_DELETION },
      // Typhoon OCR + LLM queues: concurrency=1 เพื่อป้องกัน VRAM overflow (ADR-032)
      {
        name: QUEUE_NP_DMS_OCR,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
      {
        name: QUEUE_NP_DMS_AI,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      }
    ),

    // HTTP Client สำหรับเรียก n8n Webhook (ADR-018: AI สื่อสารผ่าน API)
    HttpModule.register({
      timeout: 35000, // เผื่อ timeout เกิน AI_TIMEOUT_MS เล็กน้อย
      maxRedirects: 3,
    }),

    // Config สำหรับ AI Env Vars
    ConfigModule,

    // Redis Module สำหรับ @InjectRedis() (AiRagService)
    RedisModule,

    // UserModule สำหรับ RbacGuard (ต้องการ UserService)
    UserModule,
    MigrationModule,
    TagsModule,
    FileStorageModule,
    AuditLogModule,

    // ADR-024: Intent Classification (Hybrid Pattern → LLM Fallback)
    IntentClassifierModule,
    // ADR-025: AI Tool Layer (Tool Registry + CASL-enforced Tool Services)
    AiToolModule,
    // ADR-029: Dynamic Prompt Management for OCR Extraction
    AiPromptsModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    AiSettingsService,
    AiPolicyService,
    AiIngestService,
    AiMigrationCheckpointService,
    AiQueueService,
    AiQdrantService,
    AiValidationService,
    OllamaService,
    OcrService,
    SandboxOcrEngineService,
    EmbeddingService,
    // ADR-032: Typhoon OCR VRAM monitoring + result caching
    VramMonitorService,
    OcrCacheService,
    AiRealtimeProcessor,
    AiBatchProcessor,
    // Phase 4: RAG BullMQ pipeline (ADR-023)
    AiRagService,
    AiRagProcessor,
    // Phase 5: Vector Deletion async processor (ADR-023 FR-008)
    AiVectorDeletionProcessor,
    // ADR-032: np-dms-ocr + np-dms-ai sequential processors (concurrency=1)
    NpDmsOcrProcessor,
    NpDmsAiProcessor,
    // US4: Execution Profiles Service (T044)
    AiExecutionProfilesService,
    // RbacGuard ต้องการ UserService จาก UserModule
    RbacGuard,
    AiEnabledGuard,
    CleanupTempFilesWorker,
  ],
  exports: [
    AiService,
    AiSettingsService,
    AiPolicyService,
    AiIngestService,
    AiMigrationCheckpointService,
    AiQueueService,
    AiQdrantService,
    AiValidationService,
    OllamaService,
    OcrService,
    SandboxOcrEngineService,
    // ADR-032: Export สำหรับใช้งานใน controller
    VramMonitorService,
    OcrCacheService,
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
