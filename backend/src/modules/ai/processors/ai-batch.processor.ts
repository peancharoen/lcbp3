// File: src/modules/ai/processors/ai-batch.processor.ts
// Change Log
// - 2026-05-15: เพิ่ม processor สำหรับ ai-batch queue ตาม ADR-023A.
// - 2026-05-15: เพิ่ม EmbeddingService สำหรับ embed-document logic (T022).
// - 2026-05-21: เพิ่มการรองรับ sandbox-rag และ sandbox-extract สำหรับ Superadmin sandbox.
// - 2026-05-21: พัฒนาระบบประมวลผล sandbox-extract พร้อมเชื่อมต่อ OcrService, OllamaService และ Redis cache
// - 2026-05-21: แก้ไข ESLint unused variable สำหรับ parseError ใน catch block
// - 2026-05-22: แก้ไข type compilation error ใน processMigrateDocument และนำช่องว่างภายในฟังก์ชันออก
// - 2026-05-25: เพิ่ม AiPromptsService เพื่อดึง Dynamic Prompt สำหรับ OCR extraction ใน sandbox และ migration pipeline
// - 2026-05-26: แก้ไข bug lockDuration=30000ms ทำให้ sandbox-extract job stall เมื่อ Ollama ใช้เวลา >30s — เพิ่ม lockDuration: 150000

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { QUEUE_AI_BATCH } from '../../common/constants/queue.constants';
import { EmbeddingService } from '../services/embedding.service';
import { AiRagService } from '../ai-rag.service';
import { OcrService } from '../services/ocr.service';
import { OllamaService } from '../services/ollama.service';
import { Project } from '../../project/entities/project.entity';
import { AiAuditLog, AiAuditStatus } from '../entities/ai-audit-log.entity';
import { TagsService } from '../../tags/tags.service';
import { MigrationService } from '../../migration/migration.service';
import { MigrationErrorType } from '../../migration/entities/migration-error.entity';
import { AiPromptsService } from '../prompts/ai-prompts.service';

interface MigrateDocumentMetadata extends Record<string, unknown> {
  documentNumber?: string;
  subject?: string;
  category?: string;
  discipline?: string;
  date?: string;
  confidence?: number;
  tags?: string[];
  summary?: string;
}

export type AiBatchJobType =
  | 'ocr'
  | 'extract-metadata'
  | 'embed-document'
  | 'sandbox-rag'
  | 'sandbox-extract'
  | 'migrate-document';

export interface AiBatchJobData {
  jobType: AiBatchJobType;
  documentPublicId: string;
  projectPublicId: string;
  payload: Record<string, unknown>;
  batchId?: string;
  idempotencyKey: string;
}

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const readNumberId = (value: unknown): number | undefined =>
  typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : undefined;

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const parseMigrateDocumentMetadata = (
  cleanedResponse: string
): MigrateDocumentMetadata => {
  const parsed: unknown = JSON.parse(cleanedResponse);
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }
  const source = parsed as Record<string, unknown>;
  return {
    documentNumber: readString(source.documentNumber),
    subject: readString(source.subject),
    category: readString(source.category),
    discipline: readString(source.discipline),
    date: readString(source.date),
    confidence:
      typeof source.confidence === 'number' ? source.confidence : undefined,
    tags: toStringList(source.tags),
    summary: readString(source.summary),
  };
};

/** Processor สำหรับงาน AI batch ที่รันทีละงานเพื่อคุม VRAM
 *  lockDuration: 150000ms — รองรับ Ollama sandbox ที่ใช้เวลาสูงสุด 120s (ADR-029 FR-008)
 *  ค่า default ของ BullMQ คือ 30000ms ซึ่งน้อยกว่า timeout → job stall
 */
@Processor(QUEUE_AI_BATCH, { concurrency: 1, lockDuration: 150000 })
export class AiBatchProcessor extends WorkerHost {
  private readonly logger = new Logger(AiBatchProcessor.name);
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(AiAuditLog)
    private readonly aiAuditLogRepo: Repository<AiAuditLog>,
    private readonly embeddingService: EmbeddingService,
    private readonly ragService: AiRagService,
    private readonly ocrService: OcrService,
    private readonly ollamaService: OllamaService,
    private readonly tagsService: TagsService,
    private readonly migrationService: MigrationService,
    private readonly aiPromptsService: AiPromptsService,
    @InjectRedis() private readonly redis: Redis
  ) {
    super();
  }

  /** Dispatch งาน batch ตาม jobType */
  async process(job: Job<AiBatchJobData>): Promise<void> {
    const isSandbox =
      job.data.jobType === 'sandbox-rag' ||
      job.data.jobType === 'sandbox-extract';
    if (!isSandbox) {
      await this.setAiProcessingStatus(job.data.documentPublicId, 'PROCESSING');
    }
    try {
      switch (job.data.jobType) {
        case 'ocr':
          this.logger.log(`OCR batch job processing — jobId=${String(job.id)}`);
          if (!isSandbox) {
            await this.setAiProcessingStatus(job.data.documentPublicId, 'DONE');
          }
          return;
        case 'extract-metadata':
          this.logger.log(
            `Metadata extraction job processing — jobId=${String(job.id)}`
          );
          if (!isSandbox) {
            await this.setAiProcessingStatus(job.data.documentPublicId, 'DONE');
          }
          return;
        case 'embed-document':
          this.logger.log(`Embedding job processing — jobId=${String(job.id)}`);
          await this.processEmbedDocument(job.data);
          if (!isSandbox) {
            await this.setAiProcessingStatus(job.data.documentPublicId, 'DONE');
          }
          return;
        case 'sandbox-rag':
          this.logger.log(
            `Sandbox RAG job processing — jobId=${String(job.id)}`
          );
          await this.processSandboxRag(job.data);
          return;
        case 'sandbox-extract':
          this.logger.log(
            `Sandbox Extract job processing — jobId=${String(job.id)}`
          );
          await this.processSandboxExtract(job.data);
          return;
        case 'migrate-document':
          this.logger.log(
            `Migrate document job processing — jobId=${String(job.id)}`
          );
          await this.processMigrateDocument(job);
          if (!isSandbox) {
            await this.setAiProcessingStatus(job.data.documentPublicId, 'DONE');
          }
          return;
        default: {
          const unreachable: never = job.data.jobType;
          throw new Error(
            `Unsupported ai-batch jobType: ${String(unreachable)}`
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Batch job failed — jobType=${job.data.jobType}, documentPublicId=${job.data.documentPublicId}`,
        err instanceof Error ? err.stack : String(err)
      );
      if (!isSandbox) {
        await this.setAiProcessingStatus(job.data.documentPublicId, 'FAILED');
      }
      throw err;
    }
  }

  /** ประมวลผล embed-document job ด้วย EmbeddingService (T022) */
  private async processEmbedDocument(data: AiBatchJobData): Promise<void> {
    const { documentPublicId, projectPublicId, payload } = data;
    const pdfPath = payload.pdfPath as string;
    const extractedText = payload.extractedText as string | undefined;
    if (!pdfPath) {
      throw new Error('pdfPath is required for embed-document job');
    }
    const result = await this.embeddingService.embedDocument(
      pdfPath,
      documentPublicId,
      projectPublicId,
      extractedText
    );
    if (!result.success) {
      throw new Error(`Embedding failed: ${result.error ?? 'Unknown error'}`);
    }
    this.logger.log(
      `Embedding completed for document ${documentPublicId} — ${result.chunksEmbedded} chunks embedded`
    );
  }

  /** ประมวลผล sandbox RAG query */
  private async processSandboxRag(data: AiBatchJobData): Promise<void> {
    const { projectPublicId, idempotencyKey, payload } = data;
    const query = payload.query as string;
    const userPublicId = payload.userPublicId as string;
    const controller = new AbortController();
    this.abortControllers.set(idempotencyKey, controller);
    try {
      await this.ragService.processQuery(
        idempotencyKey,
        query,
        projectPublicId,
        userPublicId,
        controller.signal
      );
    } finally {
      this.abortControllers.delete(idempotencyKey);
    }
  }

  private async setAiProcessingStatus(
    documentPublicId: string,
    status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'
  ): Promise<void> {
    await this.attachmentRepo.update(
      { publicId: documentPublicId },
      { aiProcessingStatus: status }
    );
  }

  /** ประมวลผล sandbox OCR + Metadata extraction โดยไม่บันทึกลง database */
  private async processSandboxExtract(data: AiBatchJobData): Promise<void> {
    const { idempotencyKey, payload } = data;
    const pdfPath = payload.pdfPath as string;
    if (!pdfPath) {
      throw new Error('pdfPath is required for sandbox-extract job');
    }
    await this.redis.setex(
      `ai:rag:result:${idempotencyKey}`,
      3600,
      JSON.stringify({
        requestPublicId: idempotencyKey,
        status: 'processing',
      })
    );
    try {
      const ocrResult = await this.ocrService.detectAndExtract({ pdfPath });
      const { resolvedPrompt, versionNumber } =
        await this.aiPromptsService.resolveActive(
          'ocr_extraction',
          ocrResult.text
        );
      const response = await this.ollamaService.generate(resolvedPrompt, {
        timeoutMs: 120000,
      });
      const cleanedResponse = response
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      let extractedMetadata: Record<string, unknown>;
      try {
        extractedMetadata = JSON.parse(cleanedResponse) as Record<
          string,
          unknown
        >;
      } catch {
        throw new Error(
          `Failed to parse LLM response as JSON: ${cleanedResponse}`
        );
      }
      await this.aiPromptsService.saveTestResult(
        'ocr_extraction',
        versionNumber,
        extractedMetadata
      );
      await this.redis.setex(
        `ai:rag:result:${idempotencyKey}`,
        3600,
        JSON.stringify({
          requestPublicId: idempotencyKey,
          status: 'completed',
          answer: JSON.stringify(extractedMetadata, null, 2),
          promptVersionUsed: versionNumber,
          completedAt: new Date().toISOString(),
        })
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sandbox extract failed: ${errMsg}`);
      await this.redis.setex(
        `ai:rag:result:${idempotencyKey}`,
        3600,
        JSON.stringify({
          requestPublicId: idempotencyKey,
          status: 'failed',
          errorMessage: errMsg,
          completedAt: new Date().toISOString(),
        })
      );
      throw err;
    }
  }

  private async processMigrateDocument(
    job: Job<AiBatchJobData>
  ): Promise<void> {
    const startTime = Date.now();
    const { documentPublicId, projectPublicId, payload, batchId } = job.data;
    const docNumber = payload.documentNumber as string;
    const attachment = await this.attachmentRepo.findOne({
      where: { publicId: documentPublicId },
    });
    if (!attachment) {
      throw new Error(`ไม่พบ attachment สำหรับ publicId: ${documentPublicId}`);
    }
    const project = await this.projectRepo.findOne({
      where: { publicId: projectPublicId },
    });
    if (!project) {
      throw new Error(`ไม่พบโครงการสำหรับ publicId: ${projectPublicId}`);
    }
    let ocrResult;
    try {
      ocrResult = await this.ocrService.detectAndExtract({
        pdfPath: attachment.filePath,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`OCR สกัดข้อมูลล้มเหลว: ${errMsg}`);
      await this.migrationService.createError({
        batchId: batchId || 'unknown',
        documentNumber: docNumber,
        errorType: MigrationErrorType.FILE_ERROR,
        errorMessage: errMsg,
      });
      await this.saveAiAuditLog({
        documentPublicId,
        aiModel: 'ocr-engine',
        status: AiAuditStatus.FAILED,
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
      });
      throw err;
    }
    const { resolvedPrompt } = await this.aiPromptsService.resolveActive(
      'ocr_extraction',
      ocrResult.text
    );
    let aiResponse: string;
    try {
      aiResponse = await this.ollamaService.generate(resolvedPrompt, {
        timeoutMs: 120000,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`การวิเคราะห์ของ AI ล้มเหลว: ${errMsg}`);
      await this.migrationService.createError({
        batchId: batchId || 'unknown',
        documentNumber: docNumber,
        errorType: MigrationErrorType.API_ERROR,
        errorMessage: errMsg,
      });
      await this.saveAiAuditLog({
        documentPublicId,
        aiModel: this.ollamaService.getMainModelName(),
        status: AiAuditStatus.FAILED,
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
      });
      throw err;
    }
    const cleanedResponse = aiResponse
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    let extractedMetadata: MigrateDocumentMetadata;
    try {
      extractedMetadata = parseMigrateDocumentMetadata(cleanedResponse);
    } catch (_err: unknown) {
      const errMsg = `ไม่สามารถแปลงผลลัพธ์ของ AI เป็น JSON ได้: ${cleanedResponse}`;
      this.logger.error(errMsg);
      await this.migrationService.createError({
        batchId: batchId || 'unknown',
        documentNumber: docNumber,
        errorType: MigrationErrorType.AI_PARSE_ERROR,
        errorMessage: errMsg,
        rawAiResponse: aiResponse,
      });
      await this.saveAiAuditLog({
        documentPublicId,
        aiModel: this.ollamaService.getMainModelName(),
        status: AiAuditStatus.FAILED,
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
      });
      throw new Error(errMsg);
    }
    let mappedTags: Record<string, string>[] = [];
    if (extractedMetadata.tags && extractedMetadata.tags.length > 0) {
      const tags = await this.tagsService.findOrCreateTags(
        project.id,
        extractedMetadata.tags,
        attachment.uploadedByUserId
      );
      mappedTags = tags.map((t) => ({
        publicId: t.publicId,
        tagName: t.tagName,
      }));
    }
    const confidence =
      typeof extractedMetadata.confidence === 'number'
        ? extractedMetadata.confidence
        : 0.5;
    const isValid = confidence >= 0.6 && !!extractedMetadata.documentNumber;
    const payloadTitle = readString(payload.title);
    await this.migrationService.enqueueRecord({
      documentNumber: extractedMetadata.documentNumber || docNumber,
      subject: extractedMetadata.subject || payloadTitle,
      originalSubject: payloadTitle,
      body: extractedMetadata.summary || '',
      category: extractedMetadata.category || 'Correspondence',
      aiSummary: extractedMetadata.summary || '',
      projectId: project.id,
      senderOrgId: readNumberId(payload.senderOrgId),
      receiverOrgId: readNumberId(payload.receiverOrgId),
      issuedDate: extractedMetadata.date || undefined,
      receivedDate: extractedMetadata.date || undefined,
      extractedTags: mappedTags,
      tempAttachmentId: attachment.id,
      isValid,
      confidence,
      aiJobId: String(job.id),
      details: {
        discipline: extractedMetadata.discipline,
      },
    });
    await this.saveAiAuditLog({
      documentPublicId,
      aiModel: this.ollamaService.getMainModelName(),
      status: AiAuditStatus.SUCCESS,
      aiSuggestionJson: extractedMetadata,
      confidenceScore: confidence,
      processingTimeMs: Date.now() - startTime,
    });
    this.logger.log(
      `ประมวลผลเอกสาร ${docNumber} สำเร็จและถูกส่งเข้า Staging Queue แล้ว`
    );
  }

  private async saveAiAuditLog(data: {
    documentPublicId: string;
    aiModel: string;
    status: AiAuditStatus;
    aiSuggestionJson?: Record<string, unknown>;
    confidenceScore?: number;
    processingTimeMs?: number;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const log = this.aiAuditLogRepo.create({
        documentPublicId: data.documentPublicId,
        aiModel: data.aiModel,
        modelName: data.aiModel,
        status: data.status,
        aiSuggestionJson: data.aiSuggestionJson,
        confidenceScore: data.confidenceScore,
        processingTimeMs: data.processingTimeMs,
        errorMessage: data.errorMessage,
      });
      await this.aiAuditLogRepo.save(log);
    } catch (err: unknown) {
      this.logger.error(
        `บันทึก ai_audit_logs ล้มเหลว: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
