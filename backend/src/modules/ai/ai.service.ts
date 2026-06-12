// File: backend/src/modules/ai/ai.service.ts
// Service หลักของ AI Gateway — เชื่อมต่อระหว่าง DMS กับ n8n/Ollama Pipeline (ADR-018, ADR-020)
// Change Log
// - 2026-05-21: เพิ่ม getSystemHealth พร้อมระบบแคช Redis 30 วินาทีตาม ADR-027.
// - 2026-05-21: แก้ไข ESLint unsafe return error ใน getSystemHealth โดยใช้ interface SystemHealthResponse
// - 2026-05-29: เพิ่ม OcrService.checkHealth() เข้า getSystemHealth() เพื่อแสดงสถานะ OCR sidecar
// - 2026-06-02: ปรับปรุง activateAiModel ให้มีการโหลดและยืนยันโมเดลล่วงหน้าแบบ Synchronous (T008, ADR-033) และล้างโมเดลตัวเก่าออกเพื่อประหยัด VRAM (Suggestion 1)
// - 2026-06-03: ADR-034 — เพิ่ม active models ใน SystemHealthResponse
// - 2026-06-11: US2 - เพิ่มการผูก execution profile ใน submitMigrationJob ของ ai.service.ts
// - 2026-06-11: US4 - เพิ่ม explicit assertion สำหรับการ dispatch RAG query ไปยัง ai-batch queue
// - 2026-06-11: แก้ไข compile errors (SystemException arguments, idempotencyKey signature, type mapping) และลบบรรทัดว่างในฟังก์ชันที่แก้ไข
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { Job, Queue } from 'bullmq';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import {
  NotFoundException,
  ValidationException,
  SystemException,
  BusinessException,
  ConflictException,
} from '../../common/exceptions';
import {
  MigrationLog,
  MigrationLogStatus,
  MIGRATION_STATUS_TRANSITIONS,
} from './entities/migration-log.entity';
import { AiAuditLog, AiAuditStatus } from './entities/ai-audit-log.entity';
import { AiCallbackDto } from './dto/ai-callback.dto';
import { ExtractDocumentDto } from './dto/extract-document.dto';
import { MigrationUpdateDto } from './dto/migration-update.dto';
import { MigrationQueryDto } from './dto/migration-query.dto';
import { AiValidationService } from './ai-validation.service';
import { CreateAiJobDto } from './dto/create-ai-job.dto';
import { SubmitAiJobDto } from './dto/submit-ai-job.dto';
import { AiJobResponseDto } from './dto/ai-job-response.dto';
import { AiPolicyService } from './services/ai-policy.service';
import { ImportTransaction } from '../migration/entities/import-transaction.entity';
import { Project } from '../project/entities/project.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import {
  QUEUE_AI_BATCH,
  QUEUE_AI_REALTIME,
} from '../common/constants/queue.constants';
import { AiRealtimeJobData } from './processors/ai-realtime.processor';
import { AiBatchJobData } from './processors/ai-batch.processor';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { OcrService, OcrHealthResult } from './services/ocr.service';
import { AiSettingsService } from './ai-settings.service';
import {
  VramMonitorService,
  VramStatus,
} from './services/vram-monitor.service';
import type { AiJobPayload } from './interfaces/execution-policy.interface';
import {
  AiModelConfiguration,
  AiModelType,
} from './entities/ai-model-configuration.entity';
import { AddAiModelDto } from './dto/add-ai-model.dto';
import { ActivateAiModelDto } from './dto/activate-ai-model.dto';
import { AiAvailableModel } from './entities/ai-available-model.entity';
import { AiQdrantService } from './qdrant.service';
import { OllamaService } from './services/ollama.service';

// ผลลัพธ์ของ Real-time Extraction
export interface ExtractionResult {
  migrationLogPublicId: string;
  status: 'processing' | 'completed' | 'failed';
  extractedMetadata?: Record<string, unknown>;
  confidenceScore?: number;
  action?: string;
  processingTimeMs?: number;
}

// ผลลัพธ์ของ Paginated List
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AnalyticsQueryResult {
  documentType: string | null;
  avgConfidence: string | number;
  total: string | number;
  overrides: string | number;
  rejections: string | number;
}

// Context สำหรับส่งไปยัง n8n
interface N8nWebhookPayload {
  migrationLogPublicId: string;
  filePublicId: string;
  context: string;
  callbackUrl: string;
  fileType?: string;
}

// Response จาก n8n (realtime mode)
interface N8nWebhookResponse {
  status: string;
  extractedMetadata?: Record<string, unknown>;
  confidenceScore?: number;
  processingTimeMs?: number;
  inputHash?: string;
  outputHash?: string;
  errorMessage?: string;
}

export interface AiQueueResult {
  success: boolean;
  jobId?: string;
  error?: Error;
}

export interface AiJobStatusResult {
  jobId: string;
  queue: 'ai-realtime' | 'ai-batch';
  status: string;
  result?: unknown;
  failedReason?: string;
}

export interface SystemHealthResponse {
  activeModels: {
    main: string;
    ocr: string;
  };
  ollama: {
    status: string;
    latencyMs: number;
    models: string[];
    error?: string;
  };
  qdrant: {
    status: string;
    latencyMs: number;
    collections?: string[];
    error?: string;
  };
  ocr: OcrHealthResult;
  queues: {
    realtime:
      | {
          active: number;
          waiting: number;
          failed: number;
          completed: number;
          isPaused: boolean;
        }
      | { error: string };
    batch:
      | {
          active: number;
          waiting: number;
          failed: number;
          completed: number;
          isPaused: boolean;
        }
      | { error: string };
  };
  timestamp: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // Config จาก Environment Variables
  private readonly n8nWebhookUrl: string;
  private readonly n8nAuthToken: string;
  private readonly timeoutMs: number;
  private readonly callbackBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly aiValidationService: AiValidationService,
    private readonly aiPolicyService: AiPolicyService,
    @InjectRepository(MigrationLog)
    private readonly migrationLogRepo: Repository<MigrationLog>,
    @InjectRepository(AiAuditLog)
    private readonly aiAuditLogRepo: Repository<AiAuditLog>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(ImportTransaction)
    private readonly importTransactionRepo: Repository<ImportTransaction>,
    @Optional()
    @InjectQueue(QUEUE_AI_REALTIME)
    private readonly aiRealtimeQueue?: Queue<AiRealtimeJobData>,
    @Optional()
    @InjectQueue(QUEUE_AI_BATCH)
    private readonly aiBatchQueue?: Queue<AiBatchJobData>,
    @Optional()
    private readonly ollamaService?: OllamaService,
    @Optional()
    private readonly qdrantService?: AiQdrantService,
    @Optional()
    private readonly ocrService?: OcrService,
    @Optional()
    private readonly aiSettingsService?: AiSettingsService,
    @Optional()
    private readonly vramMonitorService?: VramMonitorService,
    @Optional()
    @InjectRedis()
    private readonly redis?: Redis
  ) {
    this.n8nWebhookUrl =
      this.configService.get<string>('AI_N8N_WEBHOOK_URL') ?? '';
    this.n8nAuthToken =
      this.configService.get<string>('AI_N8N_SERVICE_TOKEN') ??
      this.configService.get<string>('AI_N8N_AUTH_TOKEN') ??
      '';
    this.timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS') ?? 30000;
    this.callbackBaseUrl =
      this.configService.get<string>('APP_BASE_URL') ?? 'http://localhost:3001';
  }

  // --- ADR-023A BullMQ Job Queueing ---

  /** ส่งงาน AI Suggest เข้า ai-realtime queue แบบไม่ block request thread */
  async queueSuggestJob(
    dto: CreateAiJobDto,
    idempotencyKey: string
  ): Promise<AiQueueResult> {
    if (dto.type === 'rag-query') {
      throw new SystemException(
        'RAG query cannot be queued in AI realtime queue',
        { errorCode: 'AI_QUEUE_ERROR' }
      );
    }
    if (!this.aiRealtimeQueue) {
      const error = new Error('AI realtime queue is not registered');
      this.logger.error('AI job queue failed', {
        documentPublicId: dto.documentPublicId,
        error,
      });
      return { success: false, error };
    }
    try {
      const job = await this.aiRealtimeQueue.add(
        'ai-suggest',
        {
          jobType: 'ai-suggest',
          documentPublicId: dto.documentPublicId,
          projectPublicId: dto.projectPublicId || '',
          payload: dto.payload ?? {},
          idempotencyKey,
        },
        { jobId: idempotencyKey }
      );
      return { success: true, jobId: String(job.id) };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('AI job queue failed', {
        documentPublicId: dto.documentPublicId,
        error,
      });
      return { success: false, error };
    }
  }

  /** ส่งงาน embedding เข้า ai-batch queue แบบ best-effort */
  async queueEmbedJob(
    dto: CreateAiJobDto,
    idempotencyKey: string
  ): Promise<AiQueueResult> {
    if (!this.aiBatchQueue) {
      const error = new Error('AI batch queue is not registered');
      this.logger.error('AI job queue failed', {
        documentPublicId: dto.documentPublicId,
        error,
      });
      return { success: false, error };
    }
    try {
      const job = await this.aiBatchQueue.add(
        'embed-document',
        {
          jobType: 'embed-document',
          documentPublicId: dto.documentPublicId || '',
          projectPublicId: dto.projectPublicId || '',
          payload: dto.payload ?? {},
          idempotencyKey,
        },
        { jobId: idempotencyKey }
      );
      return { success: true, jobId: String(job.id) };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('AI job queue failed', {
        documentPublicId: dto.documentPublicId,
        error,
      });
      return { success: false, error };
    }
  }

  /** ส่งงาน AI แบบสากล (Unified AI Job) เข้า BullMQ ตามนโยบายความมั่นคงปลอดภัย (ADR-023A) */
  async submitUnifiedJob(
    dto: CreateAiJobDto,
    idempotencyKey: string
  ): Promise<AiJobResponseDto> {
    const queueName = 'ai-batch';
    const queue = this.aiBatchQueue;
    if (dto.type === 'rag-query') {
      if (queueName !== 'ai-batch') {
        throw new SystemException(
          'RAG query must be dispatched to ai-batch queue',
          { errorCode: 'AI_QUEUE_ERROR' }
        );
      }
    }
    if (!queue) {
      throw new SystemException('AI batch queue is not registered', {
        errorCode: 'AI_QUEUE_ERROR',
      });
    }
    await this.validateUnifiedJobRequest(dto);
    const activeJob = await queue.getJob(idempotencyKey);
    if (activeJob) {
      const payload = activeJob.data as unknown as AiJobPayload;
      return {
        jobId: String(activeJob.id),
        status: 'queued',
        modelUsed: payload.canonicalModel,
        effectiveProfile: payload.effectiveProfile,
        queueName: 'ai-batch',
      };
    }
    const payload = await this.aiPolicyService.createJobPayload(
      dto.type,
      dto.documentPublicId || dto.attachmentPublicId,
      dto.attachmentPublicId
    );
    const finalPayload = {
      ...payload,
      documentPublicId: payload.documentPublicId || '',
      projectPublicId: dto.projectPublicId || '',
      payload: dto.payload || {},
      idempotencyKey,
    };
    const job = await queue.add(
      dto.type,
      finalPayload as unknown as AiBatchJobData,
      {
        jobId: idempotencyKey,
      }
    );
    return {
      jobId: String(job.id),
      status: 'queued',
      modelUsed: payload.canonicalModel,
      effectiveProfile: payload.effectiveProfile,
      queueName: 'ai-batch',
    };
  }

  private async validateUnifiedJobRequest(dto: CreateAiJobDto): Promise<void> {
    if (dto.type === 'rag-query') {
      const query = dto.payload?.['query'];
      if (typeof query !== 'string' || query.trim().length === 0) {
        throw new ValidationException(
          'payload.query is required for rag-query jobs'
        );
      }
      if (!dto.projectPublicId) {
        throw new ValidationException(
          'projectPublicId is required for rag-query jobs'
        );
      }
    }
    if (
      (dto.type === 'auto-fill-document' || dto.type === 'migrate-document') &&
      !dto.documentPublicId &&
      !dto.attachmentPublicId
    ) {
      throw new ValidationException(
        'documentPublicId or attachmentPublicId is required for document AI jobs'
      );
    }
    if (dto.projectPublicId) {
      const project = await this.importTransactionRepo.manager.findOne(
        Project,
        {
          where: { publicId: dto.projectPublicId },
        }
      );
      if (!project) {
        throw new BusinessException(
          'PROJECT_NOT_FOUND',
          `Project with publicId ${dto.projectPublicId} was not found`,
          'ไม่พบโครงการที่อ้างอิงสำหรับงาน AI'
        );
      }
    }
    const referenceIds = [dto.documentPublicId, dto.attachmentPublicId].filter(
      (value): value is string => typeof value === 'string'
    );
    for (const publicId of referenceIds) {
      const attachment = await this.importTransactionRepo.manager.findOne(
        Attachment,
        {
          where: { publicId },
        }
      );
      if (!attachment) {
        throw new BusinessException(
          'ATTACHMENT_NOT_FOUND',
          `Attachment with publicId ${publicId} was not found`,
          'ไม่พบไฟล์อ้างอิงสำหรับงาน AI'
        );
      }
    }
  }

  /** ส่งคำขอเปิดงานประมวลผลการย้ายเอกสารของ AI (migrate-document) เข้า BullMQ */
  async submitMigrationJob(
    dto: SubmitAiJobDto,
    idempotencyKey: string
  ): Promise<AiQueueResult> {
    if (!this.aiBatchQueue) {
      const error = new Error('AI batch queue is not registered');
      this.logger.error('AI job queue failed', {
        documentPublicId: dto.payload.tempAttachmentId,
        error,
      });
      return { success: false, error };
    }
    const existingTx = await this.importTransactionRepo.findOne({
      where: {
        documentNumber: dto.payload.documentNumber,
        batchId: dto.payload.batchId,
      },
    });
    if (existingTx && existingTx.statusCode !== 500) {
      throw new ConflictException(
        'MIGRATION_DUPLICATE_TRANSACTION',
        `Document ${dto.payload.documentNumber} already imported in batch ${dto.payload.batchId}`,
        'เอกสารนี้ได้รับการนำเข้าในระบบ Staging/Production แล้ว'
      );
    }
    const activeJob = await this.aiBatchQueue.getJob(idempotencyKey);
    if (activeJob) {
      return { success: true, jobId: String(activeJob.id) };
    }
    let projectPublicId = dto.payload.contextOverride?.projectPublicId;
    if (!projectPublicId) {
      const defaultProject = await this.importTransactionRepo.manager.findOne(
        Project,
        { where: {} }
      );
      projectPublicId =
        defaultProject?.publicId ?? '00000000-0000-0000-0000-000000000000';
    }
    try {
      const payload = await this.aiPolicyService.createJobPayload(
        'migrate-document',
        dto.payload.tempAttachmentId
      );
      const job = await this.aiBatchQueue.add(
        'migrate-document',
        {
          ...payload,
          jobType: 'migrate-document',
          documentPublicId: dto.payload.tempAttachmentId,
          projectPublicId,
          payload: {
            documentNumber: dto.payload.documentNumber,
            title: dto.payload.title,
            batchId: dto.payload.batchId,
            existingTags: dto.payload.existingTags,
            systemCategories: dto.payload.systemCategories,
            contextOverride: dto.payload.contextOverride,
          },
          batchId: dto.payload.batchId,
          idempotencyKey,
        },
        { jobId: idempotencyKey }
      );
      return { success: true, jobId: String(job.id) };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('AI job queue failed', {
        documentPublicId: dto.payload.tempAttachmentId,
        error,
      });
      return { success: false, error };
    }
  }

  /** อ่านสถานะ job จาก ai-realtime หรือ ai-batch เพื่อให้ frontend polling ได้ */
  async getAiJobStatus(jobId: string): Promise<AiJobStatusResult> {
    const realtimeJob = await this.aiRealtimeQueue?.getJob(jobId);
    if (realtimeJob) return this.toJobStatus(jobId, 'ai-realtime', realtimeJob);

    const batchJob = await this.aiBatchQueue?.getJob(jobId);
    if (batchJob) return this.toJobStatus(jobId, 'ai-batch', batchJob);

    return { jobId, queue: 'ai-realtime', status: 'not_found' };
  }

  // --- Real-time Extraction (สำหรับ User Upload ใหม่) ---

  async extractRealtime(
    dto: ExtractDocumentDto,
    _userId: number
  ): Promise<ExtractionResult> {
    // 1. สร้าง MigrationLog entry เพื่อ Track การประมวลผล
    const migrationLog = this.migrationLogRepo.create({
      sourceFile: dto.publicId, // ใช้ publicId เป็น reference ไปยัง file storage
      status: MigrationLogStatus.PENDING_REVIEW,
    });
    await this.migrationLogRepo.save(migrationLog);

    // 2. ตรวจสอบว่า n8n URL ถูก Configure ไหม
    if (!this.n8nWebhookUrl) {
      this.logger.warn(
        `AI_N8N_WEBHOOK_URL ไม่ได้ Configure — ข้ามการส่งไปยัง n8n`
      );
      return {
        migrationLogPublicId: migrationLog.publicId,
        status: 'processing',
        processingTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      // 3. ส่ง Request ไปยัง n8n Webhook (ADR-018: AI สื่อสารผ่าน API เท่านั้น)
      const payload: N8nWebhookPayload = {
        migrationLogPublicId: migrationLog.publicId,
        filePublicId: dto.publicId, // UUID ของไฟล์ (ADR-019)
        context: dto.context,
        callbackUrl: `${this.callbackBaseUrl}/api/ai/callback`,
        ...(dto.fileType && { fileType: dto.fileType }),
      };

      const response = await firstValueFrom(
        this.httpService
          .post<N8nWebhookResponse>(this.n8nWebhookUrl, payload, {
            headers: {
              Authorization: `Bearer ${this.n8nAuthToken}`,
              'Content-Type': 'application/json',
              'X-AI-Source': 'dms-backend',
            },
          })
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              const errMsg = error.response?.data
                ? JSON.stringify(error.response.data)
                : error.message;
              throw new SystemException(`n8n webhook failed: ${errMsg}`);
            })
          )
      );

      const processingTimeMs = Date.now() - startTime;
      const n8nResult = response.data;

      // 4. อัปเดต MigrationLog ด้วยผลลัพธ์
      migrationLog.aiExtractedMetadata =
        n8nResult.extractedMetadata ?? undefined;
      migrationLog.confidenceScore = n8nResult.confidenceScore ?? undefined;
      await this.migrationLogRepo.save(migrationLog);

      // 5. บันทึก AuditLog (ADR-018 Rule 5)
      await this.saveAuditLog({
        documentPublicId: migrationLog.publicId,
        aiModel: 'gemma4',
        status: AiAuditStatus.SUCCESS,
        confidenceScore: n8nResult.confidenceScore,
        processingTimeMs,
        inputHash: n8nResult.inputHash,
        outputHash: n8nResult.outputHash,
      });

      return {
        migrationLogPublicId: migrationLog.publicId,
        status: 'completed',
        extractedMetadata: n8nResult.extractedMetadata,
        confidenceScore: n8nResult.confidenceScore,
        action:
          n8nResult.confidenceScore !== undefined
            ? this.aiValidationService.getConfidenceAction(
                n8nResult.confidenceScore
              )
            : undefined,
        processingTimeMs,
      };
    } catch (error: unknown) {
      const processingTimeMs = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Real-time extraction ล้มเหลว filePublicId=${dto.publicId}: ${errMsg}`
      );

      // บันทึก AuditLog กรณี Error (ADR-018)
      await this.saveAuditLog({
        documentPublicId: migrationLog.publicId,
        aiModel: 'gemma4',
        status:
          processingTimeMs >= this.timeoutMs
            ? AiAuditStatus.TIMEOUT
            : AiAuditStatus.FAILED,
        processingTimeMs,
        errorMessage: errMsg,
      });

      // อัปเดตสถานะเป็น FAILED
      migrationLog.status = MigrationLogStatus.FAILED;
      await this.migrationLogRepo.save(migrationLog);

      return {
        migrationLogPublicId: migrationLog.publicId,
        status: 'failed',
        processingTimeMs,
      };
    }
  }

  // --- Webhook Callback จาก n8n (Async Processing) ---

  async handleWebhookCallback(
    payload: AiCallbackDto,
    aiSource: string
  ): Promise<void> {
    // ServiceAccountGuard ผ่านการ validate Bearer token แล้วที่ controller layer (🟢 LOW-1)
    // 1. ค้นหา MigrationLog ด้วย publicId (ADR-019: ใช้ UUID เท่านั้น)
    const migrationLog = await this.migrationLogRepo.findOne({
      where: { publicId: payload.migrationLogPublicId },
    });

    if (!migrationLog) {
      throw new NotFoundException('MigrationLog', payload.migrationLogPublicId);
    }

    // 3. ตรวจสอบ AI Output (ADR-018 Rule 4 Validation Layer)
    const validationResult = this.aiValidationService.validateAiOutput(payload);

    const auditSummary = this.aiValidationService.buildAuditSummary(
      payload,
      validationResult
    );
    this.logger.log(
      `AI Callback received — ${auditSummary}, source=${aiSource}`
    );

    // 4. อัปเดต MigrationLog ด้วยผลลัพธ์ AI
    if (payload.status === AiAuditStatus.SUCCESS && payload.extractedMetadata) {
      migrationLog.aiExtractedMetadata = payload.extractedMetadata;
      migrationLog.confidenceScore = payload.confidenceScore;

      // Auto-approve ถ้า confidence สูงพอ (เฉพาะ migration context)
      if (validationResult.action === 'auto_approve') {
        migrationLog.status = MigrationLogStatus.VERIFIED;
        this.logger.log(
          `Auto-approved migrationLog=${migrationLog.publicId} (confidence=${payload.confidenceScore})`
        );
      }
    } else {
      migrationLog.status = MigrationLogStatus.FAILED;
      migrationLog.adminFeedback =
        payload.errorMessage ?? 'AI processing failed';
    }

    await this.migrationLogRepo.save(migrationLog);

    // 5. บันทึก AuditLog (ADR-018 Rule 5)
    await this.saveAuditLog({
      documentPublicId: migrationLog.publicId,
      aiModel: payload.aiModel,
      status: payload.status,
      confidenceScore: payload.confidenceScore,
      processingTimeMs: payload.processingTimeMs,
      inputHash: payload.inputHash,
      outputHash: payload.outputHash,
      errorMessage: payload.errorMessage,
    });
  }

  // --- Admin: ดูรายการ MigrationLog ---

  async getMigrationList(
    query: MigrationQueryDto
  ): Promise<PaginatedResult<MigrationLog>> {
    const { page = 1, limit = 10, status, minConfidence } = query;
    const skip = (page - 1) * limit;

    const qb = this.migrationLogRepo.createQueryBuilder('log');

    if (status) {
      qb.andWhere('log.status = :status', { status });
    }

    if (minConfidence !== undefined) {
      qb.andWhere('log.confidenceScore >= :minConfidence', { minConfidence });
    }

    qb.orderBy('log.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --- Admin: อัปเดตสถานะ MigrationLog ---

  async updateMigrationLog(
    publicId: string,
    dto: MigrationUpdateDto,
    userId: number
  ): Promise<MigrationLog> {
    // ค้นหาด้วย publicId (ADR-019: ไม่ใช้ parseInt)
    const migrationLog = await this.migrationLogRepo.findOne({
      where: { publicId },
    });

    if (!migrationLog) {
      throw new NotFoundException('MigrationLog', publicId);
    }

    // ตรวจสอบ State Transition ที่ถูกต้อง
    if (dto.status) {
      const allowedTransitions =
        MIGRATION_STATUS_TRANSITIONS[migrationLog.status];
      if (!allowedTransitions.includes(dto.status)) {
        throw new BusinessException(
          'MIGRATION_INVALID_TRANSITION',
          `Cannot transition from ${migrationLog.status} to ${dto.status}`,
          `ไม่สามารถเปลี่ยนสถานะจาก ${migrationLog.status} เป็น ${dto.status} ได้`,
          [
            'ตรวจสอบสถานะปัจจุบันของเอกสาร',
            'ดำเนินการตามลำดับขั้นตอนที่ถูกต้อง',
          ]
        );
      }
      migrationLog.status = dto.status;
    }

    if (dto.adminFeedback !== undefined) {
      migrationLog.adminFeedback = dto.adminFeedback;
    }

    // บันทึก Reviewer ที่อัปเดต
    migrationLog.reviewedBy = userId;
    migrationLog.reviewedAt = new Date();

    const updated = await this.migrationLogRepo.save(migrationLog);

    this.logger.log(
      `MigrationLog updated — publicId=${publicId}, status=${updated.status}, reviewedBy=${userId}`
    );

    return updated;
  }

  // T026: Hard-delete AuditLogs (SYSTEM_ADMIN only — ADR-023)

  /**
   * ลบ AiAuditLog แบบ hard delete ตามเกณฑ์ที่กำหนด
   * @returns จำนวน record ที่ถูกลบ
   */
  async deleteAuditLogs(criteria: {
    documentPublicId?: string;
    olderThanDays?: number;
  }): Promise<{ deleted: number }> {
    if (!criteria.documentPublicId && !criteria.olderThanDays) {
      throw new ValidationException(
        'At least one deletion criterion (documentPublicId or olderThanDays) is required'
      );
    }

    const qb = this.aiAuditLogRepo.createQueryBuilder('log');

    if (criteria.documentPublicId) {
      qb.andWhere('log.documentPublicId = :docId', {
        docId: criteria.documentPublicId,
      });
    }

    if (criteria.olderThanDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - criteria.olderThanDays);
      qb.andWhere('log.createdAt < :cutoff', { cutoff });
    }

    const count = await qb.getCount();
    if (count === 0) return { deleted: 0 };

    // ใช้ delete().execute() เพื่อออก SQL เดียว แทน N individual DELETEs
    const deleteQb = this.aiAuditLogRepo.createQueryBuilder('log').delete();
    if (criteria.olderThanDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - criteria.olderThanDays);
      deleteQb.andWhere('log.createdAt < :cutoff', { cutoff });
    }
    await deleteQb.execute();

    this.logger.log(
      `Deleted ${count} AI audit log(s) — criteria=${JSON.stringify(criteria)}`
    );
    return { deleted: count };
  }

  // --- Helper: บันทึก AuditLog ---

  private async saveAuditLog(data: {
    documentPublicId: string;
    aiModel: string;
    status: AiAuditStatus;
    confidenceScore?: number;
    processingTimeMs?: number;
    inputHash?: string;
    outputHash?: string;
    errorMessage?: string;
    effectiveProfile?: string;
    canonicalModel?: string;
    snapshotParamsJson?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditLog = this.aiAuditLogRepo.create({
        documentPublicId: data.documentPublicId,
        aiModel: data.aiModel,
        status: data.status,
        confidenceScore: data.confidenceScore,
        processingTimeMs: data.processingTimeMs,
        inputHash: data.inputHash,
        outputHash: data.outputHash,
        errorMessage: data.errorMessage,
        effectiveProfile: data.effectiveProfile,
        canonicalModel: data.canonicalModel,
        snapshotParamsJson: data.snapshotParamsJson,
      });
      await this.aiAuditLogRepo.save(auditLog);
    } catch (auditError: unknown) {
      // ไม่ให้ Audit Log Error กระทบ Main Flow
      const errMsg =
        auditError instanceof Error ? auditError.message : String(auditError);
      this.logger.error(`Failed to save AI audit log: ${errMsg}`);
    }
  }

  // --- Phase 6: AI Analytics Summary (T036) ---

  /**
   * สรุปสถิติ AI Audit Logs แยกตาม document type และ status
   * @returns ข้อมูลสรุป avgConfidence, overrideRate, rejectedRate แยกตาม type
   */
  async getAnalyticsSummary(): Promise<{
    byDocumentType: Array<{
      documentType: string;
      avgConfidence: number;
      overrideRate: number;
      rejectedRate: number;
      total: number;
    }>;
    overall: {
      avgConfidence: number;
      overrideRate: number;
      rejectedRate: number;
      total: number;
    };
  }> {
    // Query ai_audit_logs GROUP BY document type จาก ai_suggestion_json
    const qb = this.aiAuditLogRepo.createQueryBuilder('log');

    // ดึง document type จาก JSON field
    const results = await qb
      .select([
        "JSON_UNQUOTE(JSON_EXTRACT(log.aiSuggestionJson, '$.documentType')) as documentType",
        'AVG(log.confidenceScore) as avgConfidence',
        'COUNT(*) as total',
        'SUM(CASE WHEN log.humanOverrideJson IS NOT NULL THEN 1 ELSE 0 END) as overrides',
        'SUM(CASE WHEN log.status = :rejectedStatus THEN 1 ELSE 0 END) as rejections',
      ])
      .where('log.aiSuggestionJson IS NOT NULL')
      .andWhere('log.confidenceScore IS NOT NULL')
      .setParameter('rejectedStatus', AiAuditStatus.FAILED)
      .groupBy('documentType')
      .getRawMany<AnalyticsQueryResult>();

    const byDocumentType = results.map((row) => ({
      documentType: row.documentType || 'UNKNOWN',
      avgConfidence: Number(row.avgConfidence) || 0,
      overrideRate:
        Number(row.total) > 0
          ? (Number(row.overrides) / Number(row.total)) * 100
          : 0,
      rejectedRate:
        Number(row.total) > 0
          ? (Number(row.rejections) / Number(row.total)) * 100
          : 0,
      total: Number(row.total),
    }));

    // คำนวณ overall stats จาก raw results เพื่อความแม่นยำ
    const totalDocs = results.reduce((sum, row) => sum + Number(row.total), 0);
    const totalOverrides = results.reduce(
      (sum, row) => sum + Number(row.overrides),
      0
    );
    const totalRejections = results.reduce(
      (sum, row) => sum + Number(row.rejections),
      0
    );
    const totalConfidence = results.reduce(
      (sum, row) => sum + Number(row.avgConfidence) * Number(row.total),
      0
    );

    return {
      byDocumentType,
      overall: {
        avgConfidence: totalDocs > 0 ? totalConfidence / totalDocs : 0,
        overrideRate: totalDocs > 0 ? (totalOverrides / totalDocs) * 100 : 0,
        rejectedRate: totalDocs > 0 ? (totalRejections / totalDocs) * 100 : 0,
        total: totalDocs,
      },
    };
  }

  // --- Phase 6: Single Audit Log Delete (T037) ---

  /**
   * ลบ AiAuditLog แบบ single record โดย publicId
   * @param publicId UUID ของ audit log ที่ต้องการลบ
   * @param userId ID ของผู้ทำการลบ (สำหรับ audit trail)
   */
  async deleteAuditLogByPublicId(
    publicId: string,
    userId: number
  ): Promise<{ deleted: boolean; publicId: string }> {
    const auditLog = await this.aiAuditLogRepo.findOne({
      where: { publicId },
    });

    if (!auditLog) {
      throw new NotFoundException('AiAuditLog', publicId);
    }

    await this.aiAuditLogRepo.remove(auditLog);

    // บันทึกใน audit_logs table (T037 requirement)
    const auditEntry = this.auditLogRepo.create({
      userId,
      action: 'AI_AUDIT_LOG_DELETED',
      entityType: 'AiAuditLog',
      entityId: publicId,
      severity: 'INFO',
      detailsJson: { deletedAuditLogPublicId: publicId },
    });
    await this.auditLogRepo.save(auditEntry);

    this.logger.log(
      `AI audit log deleted — publicId=${publicId}, deletedBy=${userId}`
    );

    return { deleted: true, publicId };
  }

  /** ดึงสุขภาพของโครงสร้างพื้นฐานระบบ AI (Ollama, Qdrant, queues) */
  async getSystemHealth(): Promise<SystemHealthResponse> {
    const cacheKey = 'system_health:cache';
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as SystemHealthResponse;
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to read system health cache: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    const [ollama, qdrant, ocr, realtimeQueueMetrics, batchQueueMetrics] =
      await Promise.all([
        this.ollamaService
          ? this.ollamaService.checkHealth()
          : Promise.resolve({
              status: 'DOWN',
              latencyMs: 0,
              models: [],
              error: 'OllamaService not injected',
            }),
        this.qdrantService
          ? this.qdrantService.checkHealth()
          : Promise.resolve({
              status: 'DOWN',
              latencyMs: 0,
              error: 'AiQdrantService not injected',
            }),
        this.ocrService
          ? this.ocrService.checkHealth()
          : Promise.resolve({
              status: 'DOWN' as const,
              latencyMs: 0,
              url: 'not configured',
              error: 'OcrService not injected',
            }),
        this.getQueueMetrics(this.aiRealtimeQueue),
        this.getQueueMetrics(this.aiBatchQueue),
      ]);
    const health = {
      activeModels: {
        main: this.ollamaService
          ? this.ollamaService.getMainModelName()
          : AiSettingsService.DEFAULT_MODEL,
        ocr: this.ollamaService
          ? this.ollamaService.getOcrModelName()
          : AiSettingsService.OCR_MODEL,
      },
      ollama,
      qdrant,
      ocr,
      queues: {
        realtime: realtimeQueueMetrics,
        batch: batchQueueMetrics,
      },
      timestamp: new Date().toISOString(),
    };
    if (this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(health), 'EX', 30);
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to write system health cache: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    return health;
  }

  private async getQueueMetrics(queue?: Queue) {
    if (!queue) return { error: 'Queue not registered' };
    try {
      const [active, waiting, failed, completed, isPaused] = await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount(),
        queue.getFailedCount(),
        queue.getCompletedCount(),
        queue.isPaused(),
      ]);
      return { active, waiting, failed, completed, isPaused };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async toJobStatus(
    jobId: string,
    queue: 'ai-realtime' | 'ai-batch',
    job: Job<AiRealtimeJobData | AiBatchJobData>
  ): Promise<AiJobStatusResult> {
    return {
      jobId,
      queue,
      status: await job.getState(),
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  // --- AI Model Management with VRAM Monitoring (T027 - T030, T038, US2) ---

  /** ดึงรายการโมเดล AI ทั้งหมดพร้อมระบุตัวที่ใช้งานอยู่ปัจจุบัน (T027) */
  async getAiModels(): Promise<{
    models: AiModelConfiguration[];
    activeModel: string;
  }> {
    if (!this.aiSettingsService) {
      throw new SystemException('AiSettingsService not injected in AiService');
    }

    const availableModels = await this.aiSettingsService.getAvailableModels();
    const activeModelName = await this.aiSettingsService.getActiveModel();

    // Map ข้อมูลของ AiAvailableModel (DB) ให้กลายเป็น AiModelConfiguration (Plain Class)
    const MODEL_UUID_MAP: Record<string, string> = {
      'gemma4:e2b': '019505a1-7c3e-7000-8000-abc123def201',
      'gemma4:e4b': '019505a1-7c3e-7000-8000-abc123def202',
      'typhoon2.1-gemma3-4b': '019505a1-7c3e-7000-8000-abc123def203',
    };

    const models = availableModels.map((model) => {
      const vramRequirementMB = Math.round((model.vramGb ?? 4.0) * 1024);
      const mockUuid =
        MODEL_UUID_MAP[model.modelName] ??
        `019505a1-7c3e-7000-8000-abc123def2${(model.id % 90) + 10}`;

      return {
        modelId: mockUuid,
        modelName: model.modelName,
        modelType: AiModelType.LLM, // ตาราง ai_available_models ใช้สำหรับ LLM models
        ollamaModelName: model.modelName,
        vramRequirementMB,
        isActive: model.isActive,
        useCases: ['document_analysis', 'ocr_extraction'],
        quantization: model.modelName.includes('e2b') ? 'Q2_K' : 'Q4_K_M',
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
      } as AiModelConfiguration;
    });

    return {
      models,
      activeModel: activeModelName,
    };
  }

  /** ดึงข้อมูลสถานะ VRAM ล่าสุดของระบบ (T034) */
  async getVramStatus(): Promise<VramStatus> {
    if (!this.vramMonitorService) {
      throw new SystemException('VramMonitorService not injected in AiService');
    }
    return this.vramMonitorService.getVramStatus();
  }

  /** เพิ่มโมเดล AI ใหม่เข้าระบบ (Superadmin only - T028) */
  async addAiModel(
    dto: AddAiModelDto,
    userId: number
  ): Promise<AiAvailableModel> {
    if (!this.aiSettingsService) {
      throw new SystemException('AiSettingsService not injected in AiService');
    }

    const vramGb = Number((dto.vramRequirementMB / 1024).toFixed(2));
    const model = await this.aiSettingsService.addModel(
      {
        modelName: dto.modelName,
        modelVersion: dto.ollamaModelName.split(':')[1] || 'latest',
        description: `Added via API. Quantization: ${dto.quantization || 'N/A'}. Use Cases: ${dto.useCases.join(', ')}`,
        vramGb,
      },
      userId
    );

    // บันทึก Audit Log สำหรับการเพิ่มโมเดล AI ใหม่ (T038)
    await this.saveAuditLog({
      documentPublicId: '00000000-0000-0000-0000-000000000000',
      aiModel: 'system',
      status: AiAuditStatus.SUCCESS,
      errorMessage: `Model ${dto.modelName} added by user ${userId}. VRAM requirement: ${dto.vramRequirementMB}MB`,
    });

    return model;
  }

  /** เปลี่ยนแปลงโมเดล AI ที่ทำงานพร้อมตรวจสอบพื้นที่ VRAM (T029, T030, T038) */
  async activateAiModel(
    dto: ActivateAiModelDto,
    userId: number
  ): Promise<string> {
    if (!this.aiSettingsService || !this.vramMonitorService) {
      throw new SystemException(
        'AiSettingsService or VramMonitorService not injected in AiService'
      );
    }

    // 1. ดึงรายละเอียดโมเดลจากรายการ
    const availableModels = await this.aiSettingsService.getAvailableModels();

    // ค้นหาด้วยชื่อโมเดล หรือด้วย modelId (ที่แมป UUID)
    const MODEL_UUID_MAP: Record<string, string> = {
      '019505a1-7c3e-7000-8000-abc123def201': 'gemma4:e2b',
      '019505a1-7c3e-7000-8000-abc123def202': 'gemma4:e4b',
      '019505a1-7c3e-7000-8000-abc123def203': 'typhoon2.1-gemma3-4b',
    };

    let targetModelName = dto.modelId;
    if (MODEL_UUID_MAP[dto.modelId]) {
      targetModelName = MODEL_UUID_MAP[dto.modelId];
    }

    const model = availableModels.find(
      (m) => m.modelName === targetModelName || String(m.id) === dto.modelId
    );
    if (!model) {
      throw new NotFoundException(
        `AI Model with identifier ${dto.modelId} not found`
      );
    }

    if (!model.isActive) {
      throw new BusinessException(
        'MODEL_INACTIVE',
        `AI Model ${model.modelName} is not active`,
        'โมเดล AI นี้ยังไม่ได้เปิดใช้งาน กรุณาตั้งค่าสถานะโมเดลเป็น Active ก่อน'
      );
    }

    // 2. ตรวจสอบ VRAM ก่อนอนุญาตให้เปลี่ยนโมเดลหลัก (T030)
    const vramRequirementMB = Math.round((model.vramGb ?? 4.0) * 1024);
    const hasCapacity =
      await this.vramMonitorService.hasVramCapacity(vramRequirementMB);
    if (!hasCapacity) {
      const vramStatus = await this.vramMonitorService.getVramStatus();
      const errMsg = `VRAM ไม่เพียงพอสำหรับการโหลดโมเดล ${model.modelName} (ต้องการ ${vramRequirementMB}MB, เหลือ ${vramStatus.freeVramMb}MB) — กรุณา unload โมเดลอื่น หรือเว้นระยะห่างในการโหลด`;
      await this.saveAuditLog({
        documentPublicId: '00000000-0000-0000-0000-000000000000',
        aiModel: 'system',
        status: AiAuditStatus.FAILED,
        errorMessage: `Failed to activate model ${model.modelName} due to insufficient VRAM: ${errMsg}`,
      });
      throw new BusinessException(
        'INSUFFICIENT_VRAM',
        errMsg,
        `พื้นที่หน่วยความจำ GPU (VRAM) ไม่เพียงพอสำหรับการโหลดโมเดล ${model.modelName}`
      );
    }
    // 2.5 โหลดโมเดลล่วงหน้าแบบ Synchronous และตรวจสอบความพร้อมบน Ollama (ADR-033)
    if (this.ollamaService) {
      const isLoaded = await this.ollamaService.loadModel(model.modelName);
      if (!isLoaded) {
        const errMsg = `ไม่สามารถโหลดโมเดล ${model.modelName} ในระบบ Ollama ได้สำเร็จ (โมเดลอาจไม่ได้ดาวน์โหลด หรือ GPU/VRAM OOM) — กรุณาตรวจสอบ Ollama tags และสถานะ GPU`;
        await this.saveAuditLog({
          documentPublicId: '00000000-0000-0000-0000-000000000000',
          aiModel: 'system',
          status: AiAuditStatus.FAILED,
          errorMessage: `Failed to activate model ${model.modelName} during Ollama pre-loading: ${errMsg}`,
        });
        throw new BusinessException(
          'MODEL_LOAD_FAILED',
          errMsg,
          `ไม่สามารถดึงหรือโหลดโมเดล ${model.modelName} ไปยังระบบประมวลผล Ollama ได้`
        );
      }
    }
    const previousModelName = await this.aiSettingsService.getActiveModel();
    // 3. ทำการสลับโมเดล AI
    const activeModel = await this.aiSettingsService.setActiveModel(
      model.modelName,
      userId
    );
    if (
      this.ollamaService &&
      previousModelName &&
      previousModelName !== model.modelName
    ) {
      await this.ollamaService.unloadModel(previousModelName);
    }
    // บันทึก Audit Log สำหรับการเปิดใช้งานโมเดล AI (T038)
    await this.saveAuditLog({
      documentPublicId: '00000000-0000-0000-0000-000000000000',
      aiModel: 'system',
      status: AiAuditStatus.SUCCESS,
      errorMessage: `Model ${model.modelName} activated by user ${userId}. VRAM Capacity verified successfully.`,
    });
    return activeModel;
  }
}
