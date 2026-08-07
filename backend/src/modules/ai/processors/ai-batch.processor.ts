// File: backend/src/modules/ai/processors/ai-batch.processor.ts
// Change Log
// - 2026-06-08: แก้ไขปัญหา LLM JSON response truncated โดยการเพิ่ม num_ctx เป็น 16384 ใน sandbox-extract, sandbox-ai-extract และ migrate-document (แก้ไขโดย AGY Gemini 3.5 Flash (Medium))
// - 2026-06-14: เพิ่ม case sandbox-rag-prep และ processSandboxRagPrep (T035)
// - 2026-05-15: เพิ่ม processor สำหรับ ai-batch queue ตาม ADR-023A.
// - 2026-05-15: เพิ่ม EmbeddingService สำหรับ embed-document logic (T022).
// - 2026-05-21: เพิ่มการรองรับ sandbox-rag และ sandbox-extract สำหรับ Superadmin sandbox.
// - 2026-05-21: พัฒนาระบบประมวลผล sandbox-extract พร้อมเชื่อมต่อ OcrService, OllamaService และ Redis cache
// - 2026-05-21: แก้ไข ESLint unused variable สำหรับ parseError ใน catch block
// - 2026-05-22: แก้ไข type compilation error ใน processMigrateDocument และนำช่องว่างภายในฟังก์ชันออก
// - 2026-05-25: เพิ่ม AiPromptsService เพื่อดึง Dynamic Prompt สำหรับ OCR extraction ใน sandbox และ migration pipeline
// - 2026-05-26: แก้ไข bug lockDuration=30000ms ทำให้ sandbox-extract job stall เมื่อ Ollama ใช้เวลา >30s — เพิ่ม lockDuration: 150000
// - 2026-05-28: EC-001 ใช้ findOrSuggestTags เพื่อตรวจจับ Tag ใหม่และบันทึก aiIssues; EC-002 ตรวจสอบ UUID ของผู้ส่ง/ผู้รับ และ Flag เมื่อหาไม่พบ
// - 2026-06-03: ADR-034 — เพิ่ม 'ocr-extract' job type + OCR_JOB_TYPES constant + processOcrExtract() ที่มี model switching logic (unload main → load OCR → generate → reload main)
// - 2026-06-06: แก้ไข bug LLM JSON parse failure — เพิ่ม retry logic (2 attempts), debug log raw response, และปรับปรุง error message ให้แสดงทั้ง raw และ cleaned response
// - 2026-06-11: US2 - ส่ง activeProfile ไปยัง detectAndExtract ในการประมวลผล OCR และบันทึก retrieval device metadata ใน audit logs
// - 2026-06-11: US4 - เพิ่มการรองรับ ai-suggest และ rag-query ใน batch processor หลังการทำ redirection
// - 2026-06-06: เพิ่ม OCR text truncation (MAX_OCR_TEXT_CHARS=15000) เพื่อป้องกัน context overflow เมื่อเอกสารยาวมากชน num_ctx 8192
// - 2026-06-06: [T036] เพิ่ม ollamaOptions: { num_ctx: 8192 } ใน generateStructuredJson เพื่อรองรับ prompt ยาว 18k+ chars และแก้ไข bug response ว่างจาก context window ไม่พอ
// - 2026-06-11: แก้ไข ESLint errors โดยการเพิ่ม properties (effectiveProfile, canonicalModel, snapshotParams) ใน AiBatchJobData และยกเลิกการใช้ as any
// - 2026-08-07: แก้ sandbox-rag-prep timeout 30s → ใช้ OllamaService.getBatchTimeoutMs() (env AI_BATCH_TIMEOUT_MS, default 120000) ทั้ง 6 จุด แทน hardcoded 120000/missing

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
import {
  SandboxOcrEngineService,
  SandboxOcrEngineType,
  OcrNpDmsOptions,
} from '../services/sandbox-ocr-engine.service';
import {
  OllamaService,
  OllamaGenerateOptions,
} from '../services/ollama.service';
import { Project } from '../../project/entities/project.entity';
import { AiAuditLog, AiAuditStatus } from '../entities/ai-audit-log.entity';
import { TagsService } from '../../tags/tags.service';
import { MigrationService } from '../../migration/migration.service';
import { MigrationErrorType } from '../../migration/entities/migration-error.entity';
import { AiPromptsService } from '../prompts/ai-prompts.service';
import { AiPolicyService } from '../services/ai-policy.service';
import { AiQueueService } from '../ai-queue.service';
import type { ExecutionProfile } from '../interfaces/execution-policy.interface';
import {
  parseCompareResult,
  type CompareResult,
} from '../types/migration-compare-result.type';
import { isDwgFile } from '../../migration/constants/dwg-exclusion.constant';
import { deriveTagName } from '../../migration/types/tag-mapping-rule';
import { CompareStatus } from '../../migration/entities/migration-review-queue.entity';
import { ReviewThresholdService } from '../../migration/services/review-threshold.service';
import type { ExcelMetadataDto } from '../dto/excel-metadata.dto';

interface MigrateDocumentMetadata extends Record<string, unknown> {
  projectPublicId?: string;
  correspondenceTypeCode?: string;
  disciplineCode?: string;
  originatorOrganizationPublicId?: string;
  recipients?: Array<{ organizationPublicId: string; recipientType: string }>;
  subject?: string;
  documentDate?: string;
  tags?: string[];
  summary?: string;
  confidence?: number;
}

export type AiBatchJobType =
  | 'ocr'
  | 'ocr-extract'
  | 'extract-metadata'
  | 'embed-document'
  | 'sandbox-rag'
  | 'sandbox-extract'
  | 'sandbox-ocr-only'
  | 'sandbox-ai-extract'
  | 'sandbox-rag-prep'
  | 'migrate-document'
  | 'rag-prepare'
  | 'ai-suggest'
  | 'rag-query';

/** รายการ job types ที่ต้องใช้ np-dms-ocr model — จะ trigger model switching (ADR-034) */
export const OCR_JOB_TYPES: ReadonlyArray<AiBatchJobType> = [
  'ocr-extract',
] as const;

export interface AiBatchJobData {
  jobType: AiBatchJobType;
  documentPublicId: string;
  projectPublicId: string;
  payload: Record<string, unknown>;
  batchId?: string;
  idempotencyKey: string;
  effectiveProfile?: ExecutionProfile;
  canonicalModel?: 'np-dms-ai' | 'np-dms-ocr';
  snapshotParams?: {
    temperature: number;
    topP: number;
    maxTokens: number | null;
    numCtx: number | null;
    repeatPenalty: number;
    keepAliveSeconds: number;
  };
  ocrSnapshotParams?: {
    temperature: number;
    topP: number;
    repeatPenalty: number;
  };
}

/** OCR text สูงสุดที่ส่งเข้า LLM prompt — ป้องกัน context overflow (num_ctx 8192, Thai ~3 chars/token) */
const MAX_OCR_TEXT_CHARS = 15000;
const MAX_JSON_PARSE_ATTEMPTS = 2;
const removeControlCharacters = (
  value: string,
  includeDeleteCharacter = false
): string =>
  Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      const isAsciiControl =
        (code >= 0 && code <= 8) || code === 11 || code === 12;
      const isAdditionalControl = code >= 14 && code <= 31;
      const isDeleteCharacter = includeDeleteCharacter && code === 127;
      return !isAsciiControl && !isAdditionalControl && !isDeleteCharacter;
    })
    .join('');

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

const toRecipientsList = (
  value: unknown
): Array<{ organizationPublicId: string; recipientType: string }> => {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: Array<{ organizationPublicId: string; recipientType: string }> =
    [];
  for (const item of value) {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const orgId = readString(obj.organizationPublicId);
      const type = readString(obj.recipientType);
      if (orgId && type) {
        // Normalize 'CC ' whitespace typo to 'CC'
        const normalizedType = type.trim() === 'CC' ? 'CC' : type.trim();
        result.push({
          organizationPublicId: orgId,
          recipientType: normalizedType,
        });
      }
    }
  }
  return result;
};

const parseMigrateDocumentMetadata = (
  cleanedResponse: string
): MigrateDocumentMetadata => {
  const parsed: unknown = JSON.parse(cleanedResponse);
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }
  const source = parsed as Record<string, unknown>;
  return {
    projectPublicId: readString(source.projectPublicId),
    correspondenceTypeCode: readString(source.correspondenceTypeCode),
    disciplineCode: readString(source.disciplineCode),
    originatorOrganizationPublicId: readString(
      source.originatorOrganizationPublicId
    ),
    recipients: toRecipientsList(source.recipients),
    subject: readString(source.subject),
    documentDate: readString(source.documentDate),
    confidence:
      typeof source.confidence === 'number' ? source.confidence : undefined,
    tags: toStringList(source.tags),
    summary: readString(source.summary),
  };
};

const sanitizeLlmJsonResponse = (response: string): string =>
  removeControlCharacters(
    response.replace(/```json/g, '').replace(/```/g, '')
  ).trim();

const sanitizeOcrText = (text: string): string =>
  removeControlCharacters(text.replace(/\r\n/g, '\n'), true).trim();

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
    private readonly sandboxOcrEngineService: SandboxOcrEngineService,
    private readonly ollamaService: OllamaService,
    private readonly tagsService: TagsService,
    private readonly migrationService: MigrationService,
    private readonly aiPromptsService: AiPromptsService,
    private readonly aiPolicyService: AiPolicyService,
    private readonly aiQueueService: AiQueueService,
    private readonly reviewThresholdService: ReviewThresholdService,
    @InjectRedis() private readonly redis: Redis
  ) {
    super();
  }

  /** เรียก LLM แล้ว parse JSON แบบ retry จริงเมื่อได้ผลลัพธ์ไม่สมบูรณ์
   * @param ollamaOptions - Ollama generation options เช่น num_ctx สำหรับ prompt ยาว
   */
  private async generateStructuredJson(
    prompt: string,
    options: {
      timeoutMs: number;
      model?: string;
      system?: string;
      format?: 'json';
      ollamaOptions?: {
        num_ctx?: number;
        num_predict?: number;
        temperature?: number;
        top_p?: number;
        repeat_penalty?: number;
      };
      keepAlive?: number;
    }
  ): Promise<{
    extractedMetadata: Record<string, unknown>;
    rawResponse: string;
    cleanedResponse: string;
  }> {
    let lastRawResponse = '';
    let lastCleanedResponse = '';
    for (let attempt = 1; attempt <= MAX_JSON_PARSE_ATTEMPTS; attempt += 1) {
      const rawResponse = await this.ollamaService.generate(prompt, {
        ...options,
        options: options.ollamaOptions,
        keepAlive: options.keepAlive,
      });
      const cleanedResponse = sanitizeLlmJsonResponse(rawResponse);
      lastRawResponse = rawResponse;
      lastCleanedResponse = cleanedResponse;
      this.logger.debug(`Raw LLM response: ${rawResponse}`);
      try {
        return {
          extractedMetadata: JSON.parse(cleanedResponse) as Record<
            string,
            unknown
          >,
          rawResponse,
          cleanedResponse,
        };
      } catch {
        if (attempt >= MAX_JSON_PARSE_ATTEMPTS) {
          this.logger.error(
            `Failed to parse LLM response as JSON after ${MAX_JSON_PARSE_ATTEMPTS} attempts. Raw: ${lastRawResponse}, Cleaned: ${lastCleanedResponse}`
          );
          throw new Error(
            `Failed to parse LLM response as JSON after ${MAX_JSON_PARSE_ATTEMPTS} attempts. Raw: ${lastRawResponse.substring(0, 200)}, Cleaned: ${lastCleanedResponse.substring(0, 200)}`
          );
        }
        this.logger.warn(
          `JSON parse attempt ${attempt} failed, regenerating response...`
        );
      }
    }
    throw new Error(
      `Failed to parse LLM response as JSON after ${MAX_JSON_PARSE_ATTEMPTS} attempts`
    );
  }

  /** Dispatch งาน batch ตาม jobType */
  async process(job: Job<AiBatchJobData>): Promise<void> {
    const isSandbox =
      job.data.jobType === 'sandbox-rag' ||
      job.data.jobType === 'sandbox-extract' ||
      job.data.jobType === 'sandbox-ocr-only' ||
      job.data.jobType === 'sandbox-ai-extract' ||
      job.data.jobType === 'sandbox-rag-prep';
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
        case 'ocr-extract':
          this.logger.log(
            `OCR-extract (np-dms-ocr) job processing — jobId=${String(job.id)}`
          );
          await this.processOcrExtract(job.data);
          await this.setAiProcessingStatus(job.data.documentPublicId, 'DONE');
          return;
        case 'extract-metadata':
          this.logger.log(
            `Metadata extraction job processing — jobId=${String(job.id)}`
          );
          if (!isSandbox) {
            await this.setAiProcessingStatus(job.data.documentPublicId, 'DONE');
          }
          return;
        case 'ai-suggest':
          this.logger.log(
            `AI Suggest job processing — jobId=${String(job.id)}`
          );
          await this.processSuggest(job);
          return;
        case 'rag-query':
          this.logger.log(`RAG query job processing — jobId=${String(job.id)}`);
          await this.processRagQuery(job);
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
        case 'sandbox-ocr-only':
          this.logger.log(
            `Sandbox OCR-Only job processing — jobId=${String(job.id)}`
          );
          await this.processSandboxOcrOnly(job.data);
          return;
        case 'sandbox-ai-extract':
          this.logger.log(
            `Sandbox AI-Extract job processing — jobId=${String(job.id)}`
          );
          await this.processSandboxAiExtract(job.data);
          return;
        case 'sandbox-rag-prep':
          this.logger.log(
            `Sandbox RAG Prep job processing — jobId=${String(job.id)}`
          );
          await this.processSandboxRagPrep(job.data);
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
        case 'rag-prepare':
          this.logger.log(
            `RAG prepare job processing — jobId=${String(job.id)}`
          );
          await this.processRagPrepare(job.data);
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
    const startTime = Date.now();
    const { documentPublicId, projectPublicId, payload } = data;
    const pdfPath = payload.pdfPath as string;
    const extractedText = readString(payload.extractedText);
    if (!pdfPath) {
      throw new Error('pdfPath is required for embed-document job');
    }
    const correspondenceNumber =
      readString(payload.correspondenceNumber) ?? documentPublicId;
    const docType = readString(payload.docType) ?? 'ATTACHMENT';
    const statusCode = readString(payload.statusCode) ?? 'ACTIVE';
    const revisionNumberValue = payload.revisionNumber;
    const revisionNumber =
      typeof revisionNumberValue === 'number' &&
      Number.isFinite(revisionNumberValue)
        ? revisionNumberValue
        : 1;
    const subject = readString(payload.subject) ?? documentPublicId;
    const documentDate = readString(payload.documentDate);
    const resolvedOcrText =
      extractedText ??
      (
        await this.ocrService.detectAndExtract({
          pdfPath,
          extractedText,
          documentPublicId,
          activeProfile: data.effectiveProfile,
        })
      ).text;
    const result = await this.embeddingService.embedDocument(
      projectPublicId,
      documentPublicId,
      correspondenceNumber,
      docType,
      statusCode,
      revisionNumber,
      subject,
      documentDate,
      resolvedOcrText
    );
    if (!result.success) {
      throw new Error(`Embedding failed: ${result.error ?? 'Unknown error'}`);
    }
    const durationMs = Date.now() - startTime;
    await this.saveAiAuditLog({
      documentPublicId,
      aiModel: data.canonicalModel ?? 'np-dms-ai',
      status: AiAuditStatus.SUCCESS,
      processingTimeMs: durationMs,
      effectiveProfile: data.effectiveProfile,
      canonicalModel: data.canonicalModel,
      snapshotParamsJson: {
        ...(data.snapshotParams ?? {}),
        retrievalDevice: result.device,
      },
    });
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

  /** ประมวลผล ocr-extract job ด้วย np-dms-ocr model — model switching ตาม ADR-034:
   *  unload main → load OCR (keep_alive:0) → generate OCR → OCR auto-unloads → reload main */
  private async processOcrExtract(data: AiBatchJobData): Promise<void> {
    const { documentPublicId, payload } = data;
    const mainModel = this.ollamaService.getMainModelName();
    const ocrModel = this.ollamaService.getOcrModelName();
    const prompt = (payload.prompt as string) || '';
    this.logger.log(
      `[ModelSwitch] Unloading ${mainModel} — documentPublicId=${documentPublicId}`
    );
    await this.ollamaService.unloadModel(mainModel);
    this.logger.log(`[ModelSwitch] Loading ${ocrModel} (keep_alive:0)`);
    await this.ollamaService.loadModel(ocrModel, 0);
    let ocrText = '';
    try {
      this.logger.log(`[ModelSwitch] Running OCR extraction with ${ocrModel}`);
      ocrText = await this.ollamaService.generate(prompt, {
        model: ocrModel,
        timeoutMs: this.ollamaService.getBatchTimeoutMs(),
        keepAlive: 0,
      });
    } finally {
      this.logger.log(`[ModelSwitch] Reloading ${mainModel} (keep_alive:-1)`);
      await this.ollamaService.loadModel(mainModel, -1);
    }
    await this.redis.setex(
      `ai:ocr:result:${documentPublicId}`,
      3600,
      JSON.stringify({
        documentPublicId,
        ocrText,
        model: ocrModel,
        completedAt: new Date().toISOString(),
      })
    );
    this.logger.log(
      `[ModelSwitch] OCR-extract complete — documentPublicId=${documentPublicId}`
    );
  }

  /** ประมวลผล sandbox OCR + Metadata extraction โดยไม่บันทึกลง database */
  private async processSandboxExtract(data: AiBatchJobData): Promise<void> {
    const { idempotencyKey, payload, projectPublicId } = data;
    const pdfPath = payload.pdfPath as string;
    const engineType = (payload.engineType as SandboxOcrEngineType) || 'auto';
    const overrideProjPublicId =
      (payload.projectPublicId as string) || projectPublicId;
    const overrideContractPublicId = payload.contractPublicId as
      | string
      | undefined;
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
      let ocrParams: OcrNpDmsOptions | undefined = undefined;
      if (engineType === 'np-dms-ocr') {
        try {
          const ocrDraft =
            await this.aiPolicyService.getSandboxParameters('ocr-extract');
          ocrParams = {
            temperature: ocrDraft.temperature,
            topP: ocrDraft.topP,
            repeatPenalty: ocrDraft.repeatPenalty,
          };
        } catch (err) {
          this.logger.warn(
            `Failed to fetch sandbox parameters for ocr-extract: ${String(err)}`
          );
        }
      }
      const ocrResult = await this.sandboxOcrEngineService.detectAndExtract(
        pdfPath,
        engineType,
        ocrParams
      );
      const sanitizedOcrText = sanitizeOcrText(ocrResult.text);
      if (sanitizedOcrText.length !== ocrResult.text.length) {
        this.logger.warn(
          `OCR text sanitized before LLM: raw=${ocrResult.text.length} chars, sanitized=${sanitizedOcrText.length} chars`
        );
      }

      const activePrompt =
        await this.aiPromptsService.getActive('ocr_extraction');
      if (!activePrompt) {
        throw new Error('No active ocr_extraction prompt version found');
      }

      // ดึงบริบท Master data
      // Sandbox ใช้ 'default' projectPublicId แต่ไม่ต้องการ override context
      // ดังนั้นส่ง undefined เพื่อ skip project lookup
      const masterDataContext = await this.aiPromptsService.resolveContext(
        activePrompt,
        overrideProjPublicId === 'default' ? undefined : overrideProjPublicId,
        overrideContractPublicId
      );
      const compactMasterDataContext = JSON.stringify(masterDataContext);

      const ocrTextSafe =
        sanitizedOcrText.length > MAX_OCR_TEXT_CHARS
          ? (this.logger.warn(
              `OCR text truncated: ${sanitizedOcrText.length} chars > ${MAX_OCR_TEXT_CHARS} limit (context overflow protection)`
            ),
            sanitizedOcrText.substring(0, MAX_OCR_TEXT_CHARS))
          : sanitizedOcrText;

      const resolvedPrompt = activePrompt.template
        .replace('{{ocr_text}}', ocrTextSafe)
        .replace('{{master_data_context}}', compactMasterDataContext);

      this.logger.debug(
        `Prompt stats: OCR=${ocrTextSafe.length} chars, MasterData=${compactMasterDataContext.length} chars, Total=${resolvedPrompt.length} chars`
      );

      let sandboxParams;
      try {
        sandboxParams =
          await this.aiPolicyService.getSandboxParameters('standard');
      } catch (err) {
        this.logger.warn(
          `Failed to fetch sandbox parameters for standard: ${String(err)}`
        );
      }

      const generateOptions: {
        format: 'json';
        timeoutMs: number;
        ollamaOptions?: {
          num_ctx?: number;
          num_predict?: number;
          temperature?: number;
          top_p?: number;
          repeat_penalty?: number;
        };
        keepAlive?: number;
      } = {
        format: 'json',
        timeoutMs: this.ollamaService.getBatchTimeoutMs(),
        ollamaOptions: {
          num_ctx: sandboxParams?.numCtx ?? 16384,
          num_predict: sandboxParams?.maxTokens ?? 4096,
          temperature: sandboxParams?.temperature,
          top_p: sandboxParams?.topP,
          repeat_penalty: sandboxParams?.repeatPenalty,
        },
      };
      if (sandboxParams?.keepAliveSeconds !== undefined) {
        generateOptions.keepAlive = sandboxParams.keepAliveSeconds;
      }

      const { extractedMetadata } = await this.generateStructuredJson(
        resolvedPrompt,
        generateOptions
      );
      await this.aiPromptsService.saveTestResult(
        'ocr_extraction',
        activePrompt.versionNumber,
        extractedMetadata
      );
      await this.redis.setex(
        `ai:rag:result:${idempotencyKey}`,
        3600,
        JSON.stringify({
          requestPublicId: idempotencyKey,
          status: 'completed',
          answer: JSON.stringify(extractedMetadata, null, 2),
          ocrText: sanitizedOcrText,
          ocrUsed: ocrResult.ocrUsed,
          engineUsed: ocrResult.engineUsed,
          fallbackUsed: ocrResult.fallbackUsed,
          promptVersionUsed: activePrompt.versionNumber,
          llmPrompt: resolvedPrompt,
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

  /** Step 1: OCR เท่านั้น — สำหรับตรวจคุณภาพ OCR ก่อนทดสอบ AI */
  private async processSandboxOcrOnly(data: AiBatchJobData): Promise<void> {
    const { idempotencyKey, payload } = data;
    const pdfPath = payload.pdfPath as string;
    const engineType = (payload.engineType as SandboxOcrEngineType) || 'auto';
    const ocrOptions = payload.ocrOptions as
      | { temperature?: number; topP?: number; repeatPenalty?: number }
      | undefined;

    if (!pdfPath) {
      throw new Error('pdfPath is required for sandbox-ocr-only job');
    }

    await this.redis.setex(
      `ai:rag:result:${idempotencyKey}`,
      3600,
      JSON.stringify({
        requestPublicId: idempotencyKey,
        status: 'processing',
      })
    );

    let ocrParams = ocrOptions;
    if (!ocrParams && engineType === 'np-dms-ocr') {
      try {
        const ocrDraft =
          await this.aiPolicyService.getSandboxParameters('ocr-extract');
        ocrParams = {
          temperature: ocrDraft.temperature,
          topP: ocrDraft.topP,
          repeatPenalty: ocrDraft.repeatPenalty,
        };
      } catch (err) {
        this.logger.warn(
          `Failed to fetch sandbox parameters for ocr-extract: ${String(err)}`
        );
      }
    }

    try {
      const ocrResult = await this.sandboxOcrEngineService.detectAndExtract(
        pdfPath,
        engineType,
        ocrParams
      );
      const sanitizedOcrText = sanitizeOcrText(ocrResult.text);
      if (sanitizedOcrText.length !== ocrResult.text.length) {
        this.logger.warn(
          `OCR text sanitized before cache: raw=${ocrResult.text.length} chars, sanitized=${sanitizedOcrText.length} chars`
        );
      }

      // Cache OCR text สำหรับ Step 2
      await this.redis.setex(
        `ai:sandbox:ocr:${idempotencyKey}`,
        3600,
        JSON.stringify({
          ocrText: sanitizedOcrText,
          ocrUsed: ocrResult.ocrUsed,
          engineUsed: ocrResult.engineUsed,
          fallbackUsed: ocrResult.fallbackUsed,
          timestamp: new Date().toISOString(),
        })
      );

      await this.redis.setex(
        `ai:rag:result:${idempotencyKey}`,
        3600,
        JSON.stringify({
          requestPublicId: idempotencyKey,
          status: 'completed',
          ocrText: sanitizedOcrText,
          ocrUsed: ocrResult.ocrUsed,
          engineUsed: ocrResult.engineUsed,
          fallbackUsed: ocrResult.fallbackUsed,
          completedAt: new Date().toISOString(),
        })
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sandbox OCR-only failed: ${errMsg}`);
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

  /** Step 2: AI Extraction — ใช้ OCR text ที่ cache จาก Step 1 */
  private async processSandboxAiExtract(data: AiBatchJobData): Promise<void> {
    const { idempotencyKey, payload, projectPublicId } = data;
    const promptVersion = (payload.promptVersion as number) || undefined;

    await this.redis.setex(
      `ai:rag:result:${idempotencyKey}`,
      3600,
      JSON.stringify({
        requestPublicId: idempotencyKey,
        status: 'processing',
      })
    );

    try {
      // ดึง OCR text จาก cache
      const cachedOcr = await this.redis.get(
        `ai:sandbox:ocr:${idempotencyKey}`
      );
      if (!cachedOcr) {
        throw new Error(
          'OCR text not found or expired, please run Step 1 first'
        );
      }
      const parsedOcr = JSON.parse(cachedOcr) as {
        ocrText: string;
        ocrUsed: boolean;
        engineUsed?: string;
        fallbackUsed?: boolean;
        timestamp: string;
      };
      const ocrText = sanitizeOcrText(parsedOcr.ocrText);
      if (ocrText.length !== parsedOcr.ocrText.length) {
        this.logger.warn(
          `Cached OCR text sanitized before AI extraction: raw=${parsedOcr.ocrText.length} chars, sanitized=${ocrText.length} chars`
        );
      }

      // ดึง prompt version
      const activePrompt =
        await this.aiPromptsService.getActive('ocr_extraction');
      if (!activePrompt) {
        throw new Error('No active ocr_extraction prompt version found');
      }

      // ถ้าระบุ promptVersion ให้ใช้ version นั้น
      const targetPrompt = promptVersion
        ? await this.aiPromptsService.findByVersion(
            'ocr_extraction',
            promptVersion
          )
        : activePrompt;

      if (!targetPrompt) {
        throw new Error(`Prompt version ${promptVersion} not found`);
      }

      // Resolve context และ run LLM
      // Sandbox ใช้ 'default' projectPublicId แต่ไม่ต้องการ override context
      // ดังนั้นส่ง undefined เพื่อ skip project lookup
      const overrideProjPublicId =
        (payload.projectPublicId as string) || projectPublicId;
      const overrideContractPublicId = payload.contractPublicId as
        | string
        | undefined;
      const masterDataContext = await this.aiPromptsService.resolveContext(
        targetPrompt,
        overrideProjPublicId === 'default' ? undefined : overrideProjPublicId,
        overrideContractPublicId
      );
      const compactMasterDataContext = JSON.stringify(masterDataContext);

      const ocrTextSafe =
        ocrText.length > MAX_OCR_TEXT_CHARS
          ? (this.logger.warn(
              `OCR text truncated: ${ocrText.length} chars > ${MAX_OCR_TEXT_CHARS} limit (context overflow protection)`
            ),
            ocrText.substring(0, MAX_OCR_TEXT_CHARS))
          : ocrText;

      const resolvedPrompt = targetPrompt.template
        .replace('{{ocr_text}}', ocrTextSafe)
        .replace('{{master_data_context}}', compactMasterDataContext);
      this.logger.debug(
        `Prompt stats: OCR=${ocrTextSafe.length} chars, MasterData=${compactMasterDataContext.length} chars, Total=${resolvedPrompt.length} chars`
      );

      let sandboxParams;
      try {
        sandboxParams =
          await this.aiPolicyService.getSandboxParameters('standard');
      } catch (err) {
        this.logger.warn(
          `Failed to fetch sandbox parameters for standard: ${String(err)}`
        );
      }

      const generateOptions: {
        format: 'json';
        timeoutMs: number;
        ollamaOptions?: {
          num_ctx?: number;
          num_predict?: number;
          temperature?: number;
          top_p?: number;
          repeat_penalty?: number;
        };
        keepAlive?: number;
      } = {
        format: 'json',
        timeoutMs: this.ollamaService.getBatchTimeoutMs(),
        ollamaOptions: {
          num_ctx: sandboxParams?.numCtx ?? 16384,
          num_predict: sandboxParams?.maxTokens ?? 4096,
          temperature: sandboxParams?.temperature,
          top_p: sandboxParams?.topP,
          repeat_penalty: sandboxParams?.repeatPenalty,
        },
      };
      if (sandboxParams?.keepAliveSeconds !== undefined) {
        generateOptions.keepAlive = sandboxParams.keepAliveSeconds;
      }

      const { extractedMetadata } = await this.generateStructuredJson(
        resolvedPrompt,
        generateOptions
      );

      await this.aiPromptsService.saveTestResult(
        'ocr_extraction',
        targetPrompt.versionNumber,
        extractedMetadata
      );

      await this.redis.setex(
        `ai:rag:result:${idempotencyKey}`,
        3600,
        JSON.stringify({
          requestPublicId: idempotencyKey,
          status: 'completed',
          answer: JSON.stringify(extractedMetadata, null, 2),
          ocrText,
          ocrUsed: parsedOcr.ocrUsed,
          engineUsed: parsedOcr.engineUsed,
          fallbackUsed: parsedOcr.fallbackUsed,
          promptVersionUsed: targetPrompt.versionNumber,
          llmPrompt: resolvedPrompt,
          completedAt: new Date().toISOString(),
        })
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sandbox AI-extract failed: ${errMsg}`);
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

  private async processRagPrepare(data: AiBatchJobData): Promise<void> {
    const startTime = Date.now();
    const payload = data.payload || {};
    const documentPublicId =
      (payload.documentPublicId as string) || data.documentPublicId;
    const projectPublicId =
      (payload.projectPublicId as string) || data.projectPublicId;
    const correspondenceNumber = (payload.correspondenceNumber as string) || '';
    const docType = (payload.docType as string) || 'LETTER';
    const statusCode = (payload.statusCode as string) || 'IN_REVIEW';
    const revisionNumber = Number(payload.revisionNumber ?? 1);
    const subject = (payload.subject as string) || '';
    const documentDate = (payload.documentDate as string) || undefined;
    let cachedOcrText = (payload.cachedOcrText as string) || undefined;
    const attachmentPath = (payload.attachmentPath as string) || undefined;
    const attachmentPublicId =
      (payload.attachmentPublicId as string) || undefined;
    this.logger.log(
      `processRagPrepare: starting for doc=${documentPublicId}, project=${projectPublicId}`
    );
    // FR-014, SC-006: อ่าน persisted ocr_text จาก attachment ก่อนเสมอ — ไม่เรียก OCR ซ้ำ
    if (!cachedOcrText && documentPublicId) {
      const attachment = await this.attachmentRepo.findOne({
        where: { publicId: documentPublicId },
        select: ['id', 'ocrText', 'originalFilename', 'mimeType'],
      });
      if (attachment?.ocrText && attachment.ocrText.trim().length > 0) {
        cachedOcrText = attachment.ocrText;
        this.logger.log(
          `processRagPrepare: reused persisted ocr_text (${cachedOcrText.length} chars) for ${documentPublicId} — no re-OCR (FR-014, SC-006)`
        );
      }
    }
    if (!cachedOcrText && attachmentPath) {
      this.logger.log(
        `processRagPrepare: No cached OCR text. Extracting text from ${attachmentPath}...`
      );
      try {
        const ocrResult = await this.ocrService.detectAndExtract({
          pdfPath: attachmentPath,
          activeProfile: data.effectiveProfile,
        });
        cachedOcrText = ocrResult.text;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`processRagPrepare: OCR extraction failed: ${msg}`);
        throw err;
      }
    }
    if (!cachedOcrText) {
      this.logger.warn(
        `processRagPrepare: ไม่มี OCR text และไม่มี attachment path - skip embedding`
      );
      return;
    }
    if (cachedOcrText.trim().length < 50) {
      this.logger.warn(
        `processRagPrepare: OCR text สั้นเกินไป (${cachedOcrText.trim().length} chars) — skip embedding`
      );
      return;
    }
    // ADR-042: Persist OCR text ก่อนเสมอก่อน enqueue embedding job
    if (attachmentPublicId) {
      try {
        await this.attachmentRepo.update(
          { publicId: attachmentPublicId },
          { ocrText: cachedOcrText }
        );
        this.logger.log(
          `processRagPrepare: persisted ocr_text for attachment ${attachmentPublicId}`
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `processRagPrepare: failed to persist ocr_text for attachment ${attachmentPublicId}: ${msg}`
        );
      }
    }
    // ADR-042: Enqueue embed-document job แยกจาก rag-prepare เพื่อให้ retry ไม่ต้องรัน OCR ซ้ำ
    try {
      this.logger.log(
        `processRagPrepare: enqueuing embed-document for doc ${documentPublicId}...`
      );
      await this.aiQueueService.enqueueEmbedDocument({
        documentPublicId,
        projectPublicId,
        correspondenceNumber,
        docType,
        statusCode,
        revisionNumber,
        subject,
        documentDate,
        extractedText: cachedOcrText,
        pdfPath: attachmentPath,
      });
      const durationMs = Date.now() - startTime;
      await this.saveAiAuditLog({
        documentPublicId,
        aiModel: data.canonicalModel ?? 'np-dms-ai',
        status: AiAuditStatus.SUCCESS,
        processingTimeMs: durationMs,
        effectiveProfile: data.effectiveProfile,
        canonicalModel: data.canonicalModel,
        snapshotParamsJson: {
          ...(data.snapshotParams ?? {}),
        },
      });
      this.logger.log(
        `processRagPrepare: successfully persisted OCR text and enqueued embed-document for ${documentPublicId}`
      );
    } catch (err) {
      this.logger.error(
        `processRagPrepare: failed to enqueue embed-document: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * สร้าง ExcelMetadataDto จาก migrate-document job payload (FR-006)
   * ดึงค่าจาก payload.excelMetadata ถ้ามี, ถ้าไม่มี fallback จาก payload ระดับบนสุด
   */
  private buildExcelMetadata(
    payload: Record<string, unknown>,
    docNumber: string
  ): ExcelMetadataDto {
    const excelMeta =
      payload.excelMetadata &&
      typeof payload.excelMetadata === 'object' &&
      !Array.isArray(payload.excelMetadata)
        ? (payload.excelMetadata as Record<string, unknown>)
        : {};
    return {
      documentNumber: readString(excelMeta.documentNumber) || docNumber,
      subject: readString(excelMeta.subject) || readString(payload.title),
      documentDate: readString(excelMeta.documentDate),
      fromOrganization: readString(excelMeta.fromOrganization),
      toOrganization: readString(excelMeta.toOrganization),
      correspondenceType: readString(excelMeta.correspondenceType),
      discipline: readString(excelMeta.discipline),
      project: readString(excelMeta.project),
      revision: readString(excelMeta.revision),
    };
  }

  private async processMigrateDocument(
    job: Job<AiBatchJobData>
  ): Promise<void> {
    const startTime = Date.now();
    const { documentPublicId, projectPublicId, payload, batchId } = job.data;
    const modelUsed = job.data.canonicalModel;
    const docNumber = payload.documentNumber as string;
    const contextOverride =
      payload.contextOverride &&
      typeof payload.contextOverride === 'object' &&
      !Array.isArray(payload.contextOverride)
        ? (payload.contextOverride as Record<string, unknown>)
        : {};
    const _contractPublicId = readString(contextOverride.contractPublicId);
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
        activeProfile: job.data.effectiveProfile,
        ocrOptions: job.data.ocrSnapshotParams,
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
        effectiveProfile: job.data.effectiveProfile,
        canonicalModel: job.data.canonicalModel,
        snapshotParamsJson: job.data.snapshotParams,
      });
      throw err;
    }

    // ADR-042: Persist OCR text ก่อนเสมอก่อน enqueue review queue (FR-009)
    try {
      await this.attachmentRepo.update(
        { publicId: documentPublicId },
        { ocrText: ocrResult.text }
      );
      this.logger.log(
        `processMigrateDocument: persisted ocr_text for attachment ${documentPublicId}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `processMigrateDocument: failed to persist ocr_text for ${documentPublicId}: ${msg}`
      );
    }

    // FR-012a: ตรวจสอบว่าเอกสารหลักเป็น DWG/DXF หรือไม่ — ถ้าใช่ compare_status = UNAVAILABLE
    const isMainDocDwg = isDwgFile(
      attachment.mimeType,
      attachment.originalFilename
    );
    let compareStatus: CompareStatus = CompareStatus.COMPARED;
    let compareUnavailableReason: string | undefined;
    let compareResult: CompareResult | null = null;

    if (isMainDocDwg) {
      // FR-012b: เอกสารหลักเป็น DWG ไม่สามารถ OCR เพื่อเปรียบเทียบได้
      compareStatus = CompareStatus.UNAVAILABLE;
      compareUnavailableReason =
        'เอกสารหลักเป็นไฟล์ DWG/DXF ไม่มี text layer จึงไม่สามารถ OCR เพื่อเปรียบเทียบกับทะเบียนได้';
      this.logger.warn(
        `processMigrateDocument: ${documentPublicId} is DWG — compare unavailable`
      );
    } else {
      // FR-006, FR-007: เรียก migration_compare prompt เพื่อเปรียบเทียบทะเบียนกับเอกสารจริง
      const activePrompt =
        await this.aiPromptsService.getActive('migration_compare');
      if (!activePrompt) {
        throw new Error('No active prompt found for migration_compare');
      }

      // FR-006: สร้าง excel_metadata จาก payload (ทะเบียนเอกสารจาก n8n)
      const excelMetadata = this.buildExcelMetadata(payload, docNumber);
      const ocrTruncated =
        ocrResult.text.length > MAX_OCR_TEXT_CHARS ? 'true' : 'false';
      const truncatedOcrText = ocrResult.text.slice(0, MAX_OCR_TEXT_CHARS);

      const resolvedPrompt = activePrompt.template
        .replace('{{ocr_text}}', truncatedOcrText)
        .replace('{{excel_metadata}}', JSON.stringify(excelMetadata, null, 2))
        .replace('{{ocr_truncated}}', ocrTruncated);

      let aiResponse: string;
      try {
        const snapshotParams = job.data.snapshotParams;
        const generateOptions: OllamaGenerateOptions = {
          format: 'json',
          timeoutMs: this.ollamaService.getBatchTimeoutMs(),
          model: modelUsed,
        };
        if (snapshotParams) {
          generateOptions.options = {
            temperature: snapshotParams.temperature,
            top_p: snapshotParams.topP,
            num_predict: snapshotParams.maxTokens ?? undefined,
            num_ctx: snapshotParams.numCtx ?? undefined,
            repeat_penalty: snapshotParams.repeatPenalty,
          };
          generateOptions.keepAlive = snapshotParams.keepAliveSeconds;
        } else {
          generateOptions.options = { num_ctx: 16384, num_predict: 4096 };
        }
        aiResponse = await this.ollamaService.generate(
          resolvedPrompt,
          generateOptions
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`การเปรียบเทียบของ AI ล้มเหลว: ${errMsg}`);
        await this.migrationService.createError({
          batchId: batchId || 'unknown',
          documentNumber: docNumber,
          errorType: MigrationErrorType.API_ERROR,
          errorMessage: errMsg,
        });
        await this.saveAiAuditLog({
          documentPublicId,
          aiModel: modelUsed ?? this.ollamaService.getMainModelName(),
          status: AiAuditStatus.FAILED,
          errorMessage: errMsg,
          processingTimeMs: Date.now() - startTime,
          effectiveProfile: job.data.effectiveProfile,
          canonicalModel: job.data.canonicalModel,
          snapshotParamsJson: job.data.snapshotParams,
        });
        throw err;
      }

      // FR-007, FR-008: parse compare result ด้วย typed parser guard
      compareResult = parseCompareResult(aiResponse);
      if (!compareResult) {
        const errMsg = `ไม่สามารถแปลงผลลัพธ์การเปรียบเทียบเป็น JSON ที่ถูกต้องได้: ${aiResponse.substring(0, 200)}`;
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
          aiModel: modelUsed ?? this.ollamaService.getMainModelName(),
          status: AiAuditStatus.FAILED,
          errorMessage: errMsg,
          processingTimeMs: Date.now() - startTime,
          effectiveProfile: job.data.effectiveProfile,
          canonicalModel: job.data.canonicalModel,
          snapshotParamsJson: job.data.snapshotParams,
        });
        throw new Error(errMsg);
      }
    }

    // FR-010c: จับภาพ threshold ณ เวลาประมวลผลเพื่อให้ reviewGroup คำนวณซ้ำได้เหมือนเดิม
    const capturedThresholds =
      await this.reviewThresholdService.getThresholds();

    // ค่า confidence จาก compare result (หรือ 0.5 เมื่อ unavailable)
    const confidence = compareResult ? compareResult.confidence : 0.5;

    // FR-018: สร้าง tags จาก register fields (discipline, correspondenceType) — deterministic
    const aiIssues: Record<string, unknown>[] = [];
    const registerTags: string[] = [];
    const excelMeta = this.buildExcelMetadata(payload, docNumber);
    if (excelMeta.discipline) {
      const tagName = deriveTagName('discipline', excelMeta.discipline);
      if (tagName) registerTags.push(tagName);
    }
    if (excelMeta.correspondenceType) {
      const tagName = deriveTagName(
        'correspondenceType',
        excelMeta.correspondenceType
      );
      if (tagName) registerTags.push(tagName);
    }

    let mappedTags: Record<string, string>[] = [];
    if (registerTags.length > 0) {
      const tagResults = await this.tagsService.findOrSuggestTags(
        project.id,
        registerTags,
        attachment.uploadedByUserId
      );
      mappedTags = tagResults.map(({ tag }) => ({
        publicId: tag.publicId,
        tagName: tag.tagName,
      }));
      for (const { tag, isNew } of tagResults) {
        if (isNew) {
          aiIssues.push({
            type: 'NEW_TAG_SUGGESTED',
            tagPublicId: tag.publicId,
            tagName: tag.tagName,
            message: `Tag '${tag.tagName}' ถูกสร้างใหม่จาก register field — ต้องการการตรวจสอบจากมนุษย์`,
          });
        }
      }
    }

    // FR-017: Resolve org names from register to system reference data (batch in Phase 5)
    // สำหรับตอนนี้ใช้ค่าจาก register โดยตรง — MetadataResolutionService จะ resolve ในภายหลัง
    const senderOrgId = readNumberId(payload.senderOrgId);
    const primaryReceiverOrgId = readNumberId(payload.receiverOrgId);

    // 5. ดึงประเภทเอกสารโต้ตอบ (Category Type) และสาขางาน (Discipline) จาก register
    let matchedCategory = 'Correspondence';
    if (excelMeta.correspondenceType) {
      const foundType = await this.attachmentRepo.manager
        .createQueryBuilder()
        .select('t.type_name', 'name')
        .from('correspondence_types', 't')
        .where('t.type_code = :code', {
          code: excelMeta.correspondenceType,
        })
        .getRawOne<{ name: string }>();
      if (foundType) {
        matchedCategory = foundType.name;
      }
    }

    let matchedDisciplineId: number | undefined = undefined;
    if (excelMeta.discipline) {
      const foundDisp = await this.attachmentRepo.manager
        .createQueryBuilder()
        .select('d.id', 'id')
        .from('disciplines', 'd')
        .where('d.discipline_code = :code', {
          code: excelMeta.discipline,
        })
        .getRawOne<{ id: number }>();
      if (foundDisp) {
        matchedDisciplineId = Number(foundDisp.id);
      }
    }

    // 6. ส่งบันทึกเข้าสู่ Review Queue พร้อม compareResult และ capturedThresholds
    // FR-010b: isValid คำนวณจาก mismatches count vs capturedThresholds และ confidence
    const mismatchCount = compareResult ? compareResult.mismatches.length : 0;
    const isValid =
      !!docNumber &&
      compareStatus === CompareStatus.COMPARED &&
      mismatchCount <= capturedThresholds.maxMismatchFields &&
      confidence >= capturedThresholds.minConfidence;
    const payloadTitle = readString(payload.title);

    await this.migrationService.enqueueRecord({
      documentNumber: docNumber,
      subject: excelMeta.subject || payloadTitle,
      originalSubject: payloadTitle,
      body: '',
      category: matchedCategory,
      aiSummary: '',
      projectId: project.id,
      senderOrgId: senderOrgId,
      receiverOrgId: primaryReceiverOrgId,
      issuedDate: excelMeta.documentDate || undefined,
      receivedDate: excelMeta.documentDate || undefined,
      extractedTags: mappedTags,
      tempAttachmentId: attachment.id,
      isValid,
      confidence,
      aiJobId: String(job.id),
      aiIssues: aiIssues.length > 0 ? aiIssues : undefined,
      details: {
        disciplineCode: excelMeta.discipline,
        disciplineId: matchedDisciplineId,
        recipientsList: [],
        compareResult: compareResult ?? undefined,
        compareStatus,
        compareUnavailableReason,
        capturedThresholds,
      },
      compareResult: compareResult ?? undefined,
      compareStatus: compareStatus,
      compareUnavailableReason,
      capturedThresholds,
    });

    await this.saveAiAuditLog({
      documentPublicId,
      aiModel: modelUsed ?? this.ollamaService.getMainModelName(),
      status: AiAuditStatus.SUCCESS,
      aiSuggestionJson: (compareResult ?? {
        compareStatus,
        confidence,
      }) as unknown as Record<string, unknown>,
      confidenceScore: confidence,
      processingTimeMs: Date.now() - startTime,
      effectiveProfile: job.data.effectiveProfile,
      canonicalModel: job.data.canonicalModel,
      snapshotParamsJson: job.data.snapshotParams,
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
    effectiveProfile?: string;
    canonicalModel?: string;
    snapshotParamsJson?: Record<string, unknown>;
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
        effectiveProfile: data.effectiveProfile,
        canonicalModel: data.canonicalModel,
        snapshotParamsJson: data.snapshotParamsJson,
      });
      await this.aiAuditLogRepo.save(log);
    } catch (err: unknown) {
      this.logger.error(
        `บันทึก ai_audit_logs ล้มเหลว: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async processRagQuery(job: Job<AiBatchJobData>): Promise<void> {
    const payload = job.data.payload || {};
    const query = typeof payload['query'] === 'string' ? payload['query'] : '';
    if (query.trim().length === 0) {
      throw new Error('payload.query is required for rag-query jobs');
    }
    const requestPublicId =
      typeof payload['requestPublicId'] === 'string'
        ? payload['requestPublicId']
        : job.data.idempotencyKey;
    const userPublicId =
      typeof payload['userPublicId'] === 'string'
        ? payload['userPublicId']
        : 'system';
    await this.ragService.processQuery(
      requestPublicId,
      query,
      job.data.projectPublicId,
      userPublicId,
      new AbortController().signal
    );
  }

  private async processSuggest(
    job: Job<AiBatchJobData>
  ): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const payload = job.data.payload || {};
    const hasExtractedText =
      typeof payload['extractedText'] === 'string' &&
      payload['extractedText'].length > 0;

    // Pipeline B: เรียกจาก POST /ai/jobs (type: ai-suggest) พร้อม attachmentPublicId + projectPublicId
    // ไม่มี extractedText ใน payload → ต้องโหลด attachment จาก DB แล้ว run OCR
    if (
      !hasExtractedText &&
      job.data.projectPublicId &&
      job.data.documentPublicId
    ) {
      return this.processSuggestDocument(job, startTime);
    }

    // Internal flow: เรียกจาก file-storage.service.ts หลัง commit (fire-and-forget)
    try {
      if (job.data.documentPublicId) {
        await this.setAiProcessingStatus(
          job.data.documentPublicId,
          'PROCESSING'
        );
      }
      const extractedText =
        typeof payload['extractedText'] === 'string'
          ? payload['extractedText']
          : '';
      const pdfPath =
        typeof payload['pdfPath'] === 'string' ? payload['pdfPath'] : undefined;
      const extractedChars =
        typeof payload['extractedChars'] === 'number'
          ? payload['extractedChars']
          : extractedText.length;
      const textResult = await this.ocrService.detectAndExtract({
        extractedText,
        extractedChars,
        pdfPath,
      });
      const prompt = [
        'Extract concise DMS metadata from this engineering document.',
        'Return only JSON with fields: title, documentType, category, confidenceScore.',
        textResult.text.slice(0, 6000),
      ].join('\n');
      const rawOutput = await this.ollamaService.generate(prompt);
      const suggestion = this.parseSuggestion(rawOutput);
      const masterCategories = Array.isArray(payload['masterDataCategories'])
        ? (payload['masterDataCategories'] as string[])
        : undefined;
      const normalizedSuggestion = this.flagUnknownCategories(
        suggestion,
        masterCategories
      );
      await this.saveAiAuditLog({
        documentPublicId: job.data.documentPublicId,
        aiModel:
          job.data.canonicalModel ?? this.ollamaService.getMainModelName(),
        status: AiAuditStatus.SUCCESS,
        aiSuggestionJson: normalizedSuggestion,
        confidenceScore: this.extractConfidence(normalizedSuggestion),
        processingTimeMs: Date.now() - startTime,
        effectiveProfile: job.data.effectiveProfile,
        canonicalModel: job.data.canonicalModel,
        snapshotParamsJson: job.data.snapshotParams,
      });
      if (job.data.documentPublicId) {
        await this.setAiProcessingStatus(job.data.documentPublicId, 'DONE');
      }
      return {
        suggestion: normalizedSuggestion,
        ocrUsed: textResult.ocrUsed,
      };
    } catch (err) {
      if (job.data.documentPublicId) {
        await this.setAiProcessingStatus(job.data.documentPublicId, 'FAILED');
      }
      await this.saveAiAuditLog({
        documentPublicId: job.data.documentPublicId,
        aiModel:
          job.data.canonicalModel ?? this.ollamaService.getMainModelName(),
        status: AiAuditStatus.FAILED,
        processingTimeMs: Date.now() - startTime,
        errorMessage: err instanceof Error ? err.message : String(err),
        effectiveProfile: job.data.effectiveProfile,
        canonicalModel: job.data.canonicalModel,
        snapshotParamsJson: job.data.snapshotParams,
      });
      throw err;
    }
  }

  /**
   * Pipeline B: ประมวลผล AI suggestion สำหรับ New Correspondence form pre-fill
   * โหลด attachment จาก DB → OCR → AI extraction → tag suggestion (ไม่สร้าง tag ใหม่)
   * คืนค่า AiJobResult สำหรับ frontend polling (ADR-023 D6 — human-in-the-loop)
   */
  private async processSuggestDocument(
    job: Job<AiBatchJobData>,
    startTime: number
  ): Promise<Record<string, unknown>> {
    const { documentPublicId, projectPublicId } = job.data;
    const modelUsed = job.data.canonicalModel;
    try {
      // 1. โหลด attachment จาก DB (documentPublicId = attachment publicId สำหรับ Pipeline B)
      const attachment = await this.attachmentRepo.findOne({
        where: { publicId: documentPublicId },
      });
      if (!attachment) {
        throw new Error(
          `ไม่พบ attachment สำหรับ publicId: ${documentPublicId}`
        );
      }

      // 2. โหลด project สำหรับ tag lookup scope
      const project = await this.projectRepo.findOne({
        where: { publicId: projectPublicId },
      });
      if (!project) {
        throw new Error(`ไม่พบโครงการสำหรับ publicId: ${projectPublicId}`);
      }

      // 3. OCR extraction
      const ocrResult = await this.ocrService.detectAndExtract({
        pdfPath: attachment.filePath,
        activeProfile: job.data.effectiveProfile,
        ocrOptions: job.data.ocrSnapshotParams,
      });

      // 4. ดึง active prompt สำหรับ OCR extraction (ADR-025)
      const activePrompt =
        await this.aiPromptsService.getActive('ocr_extraction');
      if (!activePrompt) {
        throw new Error('No active prompt found for ocr_extraction');
      }
      const masterDataContext = await this.aiPromptsService.resolveContext(
        activePrompt,
        projectPublicId,
        undefined
      );
      const resolvedPrompt = activePrompt.template
        .replace('{{ocr_text}}', ocrResult.text.slice(0, MAX_OCR_TEXT_CHARS))
        .replace(
          '{{master_data_context}}',
          JSON.stringify(masterDataContext, null, 2)
        );

      // 5. AI extraction (LLM)
      const snapshotParams = job.data.snapshotParams;
      const generateOptions: OllamaGenerateOptions = {
        format: 'json',
        timeoutMs: this.ollamaService.getBatchTimeoutMs(),
        model: modelUsed,
      };
      if (snapshotParams) {
        generateOptions.options = {
          temperature: snapshotParams.temperature,
          top_p: snapshotParams.topP,
          num_predict: snapshotParams.maxTokens ?? undefined,
          num_ctx: snapshotParams.numCtx ?? undefined,
          repeat_penalty: snapshotParams.repeatPenalty,
        };
        generateOptions.keepAlive = snapshotParams.keepAliveSeconds;
      } else {
        generateOptions.options = { num_ctx: 16384, num_predict: 4096 };
      }
      const aiResponse = await this.ollamaService.generate(
        resolvedPrompt,
        generateOptions
      );

      // 6. Parse AI response
      const cleanedResponse = sanitizeLlmJsonResponse(aiResponse);
      let extractedMetadata: MigrateDocumentMetadata;
      try {
        extractedMetadata = parseMigrateDocumentMetadata(cleanedResponse);
      } catch {
        this.logger.warn(
          `Pipeline B: AI response ไม่ใช่ JSON ที่ถูกต้อง — ใช้ค่าเริ่มต้น`
        );
        extractedMetadata = {};
      }

      // 7. Tag suggestion (ไม่สร้าง tag ใหม่ — human-in-the-loop)
      const tagNames = extractedMetadata.tags ?? [];
      const suggestedTags =
        tagNames.length > 0
          ? await this.tagsService.suggestTags(project.id, tagNames)
          : [];

      // 8. สร้าง AiJobResult สำหรับ frontend pre-fill
      const confidence =
        typeof extractedMetadata.confidence === 'number'
          ? extractedMetadata.confidence
          : 0.5;
      const result = {
        isValid: confidence >= 0.5,
        confidence,
        category: 'Correspondence',
        summary: extractedMetadata.summary ?? '',
        suggestedTags: suggestedTags.map((t) => ({
          name: t.name,
          isNew: t.isNew,
          publicId: t.publicId,
          confidence,
        })),
        detectedIssues: [] as string[],
        suggestedSubject: extractedMetadata.subject,
        suggestedDocumentDate: extractedMetadata.documentDate,
        suggestedSenderId: extractedMetadata.originatorOrganizationPublicId,
        suggestedDisciplineId: extractedMetadata.disciplineCode,
        ocrMethod: ocrResult.ocrUsed ? 'slow-path' : 'fast-path',
        processingTimeMs: Date.now() - startTime,
      };

      // 9. Audit log
      await this.saveAiAuditLog({
        documentPublicId,
        aiModel: modelUsed ?? this.ollamaService.getMainModelName(),
        status: AiAuditStatus.SUCCESS,
        aiSuggestionJson: extractedMetadata as unknown as Record<
          string,
          unknown
        >,
        confidenceScore: confidence,
        processingTimeMs: Date.now() - startTime,
        effectiveProfile: job.data.effectiveProfile,
        canonicalModel: job.data.canonicalModel,
        snapshotParamsJson: job.data.snapshotParams,
      });

      this.logger.log(
        `Pipeline B AI suggestion สำเร็จ — jobId=${String(job.id)}, subject=${extractedMetadata.subject ?? 'N/A'}, tags=${suggestedTags.length}`
      );
      return result;
    } catch (err) {
      await this.saveAiAuditLog({
        documentPublicId,
        aiModel: modelUsed ?? this.ollamaService.getMainModelName(),
        status: AiAuditStatus.FAILED,
        processingTimeMs: Date.now() - startTime,
        errorMessage: err instanceof Error ? err.message : String(err),
        effectiveProfile: job.data.effectiveProfile,
        canonicalModel: job.data.canonicalModel,
        snapshotParamsJson: job.data.snapshotParams,
      });
      throw err;
    }
  }

  private parseSuggestion(rawOutput: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(rawOutput) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      this.logger.warn('AI suggestion output was not valid JSON');
    }
    return {
      title: rawOutput.slice(0, 250),
      confidenceScore: 0,
      is_unknown: true,
    };
  }

  private flagUnknownCategories(
    suggestion: Record<string, unknown>,
    masterDataCategories: unknown
  ): Record<string, unknown> {
    if (!Array.isArray(masterDataCategories)) return suggestion;
    const knownValues = new Set(
      masterDataCategories
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase())
    );
    const category = suggestion['category'];
    if (
      typeof category === 'string' &&
      !knownValues.has(category.toLowerCase())
    ) {
      return { ...suggestion, is_unknown: true };
    }
    return suggestion;
  }

  private extractConfidence(
    suggestion: Record<string, unknown>
  ): number | undefined {
    const confidence = suggestion['confidenceScore'];
    return typeof confidence === 'number' ? confidence : undefined;
  }

  private async processSandboxRagPrep(data: AiBatchJobData): Promise<void> {
    const { idempotencyKey, payload } = data;
    const text = payload.text as string;
    const profileId = payload.profileId as string | undefined;
    await this.redis.setex(
      `ai:rag:result:${idempotencyKey}`,
      3600,
      JSON.stringify({
        requestPublicId: idempotencyKey,
        status: 'processing',
      })
    );
    try {
      if (!text) {
        throw new Error('text is required for sandbox-rag-prep job');
      }
      const activePrompt =
        await this.aiPromptsService.getActive('rag_prep_prompt');
      if (!activePrompt) {
        throw new Error('No active rag_prep_prompt version found');
      }
      const promptText = activePrompt.template
        .replace('{{text}}', text)
        .replace('{{ocr_text}}', text);
      let sandboxParams;
      if (profileId) {
        try {
          sandboxParams =
            await this.aiPolicyService.getSandboxParameters(profileId);
        } catch (err) {
          this.logger.warn(
            `Failed to fetch sandbox parameters for profileId=${profileId}: ${String(err)}`
          );
        }
      }
      if (!sandboxParams) {
        try {
          sandboxParams =
            await this.aiPolicyService.getSandboxParameters('standard');
        } catch (err) {
          this.logger.warn(
            `Failed to fetch sandbox parameters for standard: ${String(err)}`
          );
        }
      }
      const generateOptions = {
        timeoutMs: this.ollamaService.getBatchTimeoutMs(),
        options: {
          num_ctx: sandboxParams?.numCtx ?? 8192,
          num_predict: sandboxParams?.maxTokens ?? 4096,
          temperature: sandboxParams?.temperature,
          top_p: sandboxParams?.topP,
          repeat_penalty: sandboxParams?.repeatPenalty,
        },
      };
      const llmOutput = await this.ollamaService.generate(
        promptText,
        generateOptions
      );
      const parsed = this.parseChunkTags(llmOutput);
      const chunks =
        parsed.length > 0 ? parsed : this.fixedSizeChunk(text, 512, 64);
      const ragChunks: Array<{ text: string; summary: string }> = [];
      const ragVectors: number[][] = [];
      for (const chunk of chunks) {
        try {
          const embedResult = await this.ocrService.embedViaSidecar(chunk.text);
          ragChunks.push({
            text: chunk.text,
            summary: chunk.topic,
          });
          ragVectors.push(embedResult.dense);
        } catch (err) {
          this.logger.error(
            `Sandbox embed failed for chunk: ${chunk.topic}`,
            err
          );
        }
      }
      await this.redis.setex(
        `ai:rag:result:${idempotencyKey}`,
        3600,
        JSON.stringify({
          requestPublicId: idempotencyKey,
          status: 'completed',
          ragChunks,
          ragVectors,
          completedAt: new Date().toISOString(),
        })
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sandbox RAG Prep failed: ${errMsg}`);
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

  private parseChunkTags(
    llmOutput: string
  ): Array<{ topic: string; text: string }> {
    const chunks: Array<{ topic: string; text: string }> = [];
    const regex = /<chunk\s+topic="([^"]*)"\s*>([\s\S]*?)<\/chunk\s*>/gi;
    let match;
    while ((match = regex.exec(llmOutput)) !== null) {
      const topic = match[1]?.trim() || 'ทั่วไป';
      const text = match[2]?.trim();
      if (text) {
        chunks.push({ topic, text });
      }
    }
    return chunks;
  }

  private fixedSizeChunk(
    text: string,
    chunkSize: number,
    overlap: number
  ): Array<{ topic: string; text: string }> {
    const chunks: Array<{ topic: string; text: string }> = [];
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const textLength = cleanText.length;
    let startIndex = 0;
    let chunkIndex = 0;
    while (startIndex < textLength) {
      const endIndex = Math.min(startIndex + chunkSize, textLength);
      const chunkText = cleanText.substring(startIndex, endIndex);
      chunks.push({
        topic: `ส่วนที่ ${chunkIndex + 1}`,
        text: chunkText,
      });
      startIndex += chunkSize - overlap;
      chunkIndex += 1;
    }
    return chunks;
  }
}
