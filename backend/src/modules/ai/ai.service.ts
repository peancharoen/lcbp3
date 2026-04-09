// File: src/modules/ai/ai.service.ts
// Service หลักของ AI Gateway — เชื่อมต่อระหว่าง DMS กับ n8n/Ollama Pipeline (ADR-018, ADR-020)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import {
  NotFoundException,
  ValidationException,
  SystemException,
  BusinessException,
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
    @InjectRepository(MigrationLog)
    private readonly migrationLogRepo: Repository<MigrationLog>,
    @InjectRepository(AiAuditLog)
    private readonly aiAuditLogRepo: Repository<AiAuditLog>
  ) {
    this.n8nWebhookUrl =
      this.configService.get<string>('AI_N8N_WEBHOOK_URL') ?? '';
    this.n8nAuthToken =
      this.configService.get<string>('AI_N8N_AUTH_TOKEN') ?? '';
    this.timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS') ?? 30000;
    this.callbackBaseUrl =
      this.configService.get<string>('APP_BASE_URL') ?? 'http://localhost:3001';
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
    aiSource: string,
    authHeader: string
  ): Promise<void> {
    // 1. ตรวจสอบ Service Account Authentication (ADR-018 Rule 2)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ValidationException(
        'Missing or invalid Authorization header for AI callback'
      );
    }

    const token = authHeader.substring(7);
    if (token !== this.n8nAuthToken) {
      throw new ValidationException('Invalid AI service account token');
    }

    // 2. ค้นหา MigrationLog ด้วย publicId (ADR-019: ใช้ UUID เท่านั้น)
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
      });
      await this.aiAuditLogRepo.save(auditLog);
    } catch (auditError: unknown) {
      // ไม่ให้ Audit Log Error กระทบ Main Flow
      const errMsg =
        auditError instanceof Error ? auditError.message : String(auditError);
      this.logger.error(`Failed to save AI audit log: ${errMsg}`);
    }
  }
}
