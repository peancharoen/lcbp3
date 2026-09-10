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
// - 2026-08-24: ADR-048 T004 — ลงทะเบียน NodeMetricsService สำหรับ AI Engine Control Center telemetry
// Module สำหรับ AI Gateway — ลงทะเบียน Services และ Controllers (ADR-023)

import { Logger, Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { RedisModule } from '@nestjs-modules/ioredis';
import { Queue } from 'bullmq';
import { AiController } from './ai.controller';
import { RagAttachmentController } from './rag-attachment.controller';
import { AiService } from './ai.service';
import { AiSettingsService } from './ai-settings.service';
import { AiIngestService } from './ai-ingest.service';
import { AiQueueService } from './ai-queue.service';
import { AiQdrantService } from './qdrant.service';
import { AiRagService } from './ai-rag.service';
import { AiRagProcessor } from './processors/rag.processor';
import { RagAttachmentIngestProcessor } from './processors/rag-attachment-ingest.processor';
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
import { CaslModule } from '../../common/auth/casl/casl.module';
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
import { NodeMetricsService } from './services/node-metrics.service';
import { VectorCleanupService } from './services/vector-cleanup.service';
import { PendingVectorDeletion } from './entities/pending-vector-deletion.entity';
import { RagQueryLog } from './entities/rag-query-log.entity';
import { RagAttachmentGeneration } from './entities/rag-attachment-generation.entity';
import { RagAttachmentPage } from './entities/rag-attachment-page.entity';
import { RagAttachmentChunk } from './entities/rag-attachment-chunk.entity';
import { RagGenerationLockService } from './services/rag-generation-lock.service';
import { RagErrorService } from './services/rag-error.service';
import { RagGenerationService } from './services/rag-generation.service';
import { RagGenerationStateService } from './services/rag-generation-state.service';
import { RagClassificationService } from './services/rag-classification.service';
import { RagTextSegmentService } from './services/rag-text-segment.service';
import { RagChunkingService } from './services/rag-chunking.service';
import { RagAttachmentSourceService } from './services/rag-attachment-source.service';
import { RagAttachmentIngestionService } from './services/rag-attachment-ingestion.service';
import { RagEmbeddingService } from './services/rag-embedding.service';
import { RagRetrievalService } from './services/rag-retrieval.service';
import { RagRetrievalGuardService } from './services/rag-retrieval-guard.service';
import { RagCitationService } from './services/rag-citation.service';
import { RagCleanupService } from './services/rag-cleanup.service';
import { RagGenerationSwapService } from './services/rag-generation-swap.service';
import { RagObservabilityService } from './services/rag-observability.service';
import { RagGenerationCleanupProcessor } from './processors/rag-generation-cleanup.processor';
import { RagGenerationRetentionProcessor } from './processors/rag-generation-retention.processor';
import { RagMetadataSyncProcessor } from './processors/rag-metadata-sync.processor';
import { RagPageService } from './services/rag-page.service';
import { SecureArchiveService } from '../../common/file-storage/secure-archive.service';

@Module({
  imports: [
    // Entities สำหรับ AI Module
    TypeOrmModule.forFeature([
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
      PendingVectorDeletion,
      RagQueryLog,
      RagAttachmentGeneration,
      RagAttachmentPage,
      RagAttachmentChunk,
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
      // np-dms-ocr + np-dms-ai queues: concurrency=1 เพื่อป้องกัน VRAM overflow (ADR-032)
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

    // Config สำหรับ AI Env Vars
    ConfigModule,

    // Redis Module สำหรับ @InjectRedis() (AiRagService)
    RedisModule,

    // UserModule สำหรับ RbacGuard (ต้องการ UserService)
    UserModule,
    forwardRef(() => MigrationModule),
    TagsModule,
    FileStorageModule,
    AuditLogModule,

    // ADR-024: Intent Classification (Hybrid Pattern → LLM Fallback)
    IntentClassifierModule,
    // ADR-025: AI Tool Layer (Tool Registry + CASL-enforced Tool Services)
    AiToolModule,
    // ADR-029: Dynamic Prompt Management for OCR Extraction
    AiPromptsModule,
    // CASL — AbilityFactory สำหรับ RagClassificationService + RagRetrievalGuardService
    CaslModule,
  ],
  controllers: [AiController, RagAttachmentController],
  providers: [
    AiService,
    AiSettingsService,
    AiPolicyService,
    AiIngestService,
    AiMigrationCheckpointService,
    AiQueueService,
    AiQdrantService,
    OllamaService,
    OcrService,
    SandboxOcrEngineService,
    EmbeddingService,
    // ADR-032: np-dms-ocr VRAM monitoring + result caching
    VramMonitorService,
    OcrCacheService,
    AiRealtimeProcessor,
    AiBatchProcessor,
    // Phase 4: RAG BullMQ pipeline (ADR-023)
    AiRagService,
    AiRagProcessor,
    RagAttachmentIngestProcessor,
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
    // ADR-048: AI Engine Control Center — Host-level telemetry poller
    NodeMetricsService,
    // 2026-09-03: Periodic cleanup สำหรับ Qdrant vectors (pending retry + orphan scan)
    VectorCleanupService,
    RagGenerationLockService,
    RagErrorService,
    RagGenerationService,
    RagGenerationStateService,
    RagClassificationService,
    RagTextSegmentService,
    RagChunkingService,
    RagAttachmentSourceService,
    RagAttachmentIngestionService,
    RagEmbeddingService,
    RagRetrievalService,
    RagRetrievalGuardService,
    RagCitationService,
    RagCleanupService,
    // Phase 5 US3: Generation swap, cleanup, retention, observability (Feature 254)
    RagGenerationSwapService,
    RagObservabilityService,
    RagGenerationCleanupProcessor,
    RagGenerationRetentionProcessor,
    // Phase 7 US5: Async Qdrant classification metadata sync (Feature 254, T070)
    RagMetadataSyncProcessor,
    // Phase 6 US4: Secure archive extraction + page persistence (Feature 254)
    SecureArchiveService,
    RagPageService,
  ],
  exports: [
    AiService,
    AiSettingsService,
    AiPolicyService,
    AiIngestService,
    AiMigrationCheckpointService,
    AiQueueService,
    AiQdrantService,
    OllamaService,
    OcrService,
    SandboxOcrEngineService,
    // ADR-032: Export สำหรับใช้งานใน controller
    VramMonitorService,
    OcrCacheService,
    AiRagService,
    // ADR-032: Export BullModule สำหรับ MonitoringModule inject queue metrics
    BullModule,
    // ADR-048: Export NodeMetricsService สำหรับ AI Control Center endpoint
    NodeMetricsService,
    RagGenerationLockService,
    RagErrorService,
    RagGenerationService,
    RagGenerationStateService,
    RagClassificationService,
    RagTextSegmentService,
    RagChunkingService,
    RagAttachmentSourceService,
    RagAttachmentIngestionService,
    RagEmbeddingService,
    RagRetrievalService,
    RagCleanupService,
    RagGenerationSwapService,
    RagObservabilityService,
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
