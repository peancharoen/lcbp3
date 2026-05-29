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
// - 2026-05-28: EC-001 ใช้ findOrSuggestTags เพื่อตรวจจับ Tag ใหม่และบันทึก aiIssues; EC-002 ตรวจสอบ UUID ของผู้ส่ง/ผู้รับ และ Flag เมื่อหาไม่พบ

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
    const { idempotencyKey, payload, projectPublicId } = data;
    const pdfPath = payload.pdfPath as string;
    const overrideProjPublicId =
      (payload.projectPublicId as string) || projectPublicId;
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

      const activePrompt =
        await this.aiPromptsService.getActive('ocr_extraction');
      if (!activePrompt) {
        throw new Error('No active ocr_extraction prompt version found');
      }

      // ดึงบริบท Master data
      const masterDataContext = await this.aiPromptsService.resolveContext(
        activePrompt,
        overrideProjPublicId
      );

      const resolvedPrompt = activePrompt.template
        .replace('{{ocr_text}}', ocrResult.text)
        .replace(
          '{{master_data_context}}',
          JSON.stringify(masterDataContext, null, 2)
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
          ocrText: ocrResult.text,
          ocrUsed: ocrResult.ocrUsed,
          promptVersionUsed: activePrompt.versionNumber,
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
    const contextOverride =
      payload.contextOverride &&
      typeof payload.contextOverride === 'object' &&
      !Array.isArray(payload.contextOverride)
        ? (payload.contextOverride as Record<string, unknown>)
        : {};
    const contractPublicId = readString(contextOverride.contractPublicId);
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

    const activePrompt =
      await this.aiPromptsService.getActive('ocr_extraction');
    if (!activePrompt) {
      throw new Error('No active prompt found for ocr_extraction');
    }

    // ดึงบริบทอ้างอิงโครงการที่กรองแล้ว (Data Isolation)
    const masterDataContext = await this.aiPromptsService.resolveContext(
      activePrompt,
      projectPublicId,
      contractPublicId
    );

    const resolvedPrompt = activePrompt.template
      .replace('{{ocr_text}}', ocrResult.text)
      .replace(
        '{{master_data_context}}',
        JSON.stringify(masterDataContext, null, 2)
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

    // 3. ตรวจสอบและค้นหา Tags Suggestion ร่วมกับ Auto-Diff (EC-001)
    const aiIssues: Record<string, unknown>[] = [];
    let mappedTags: Record<string, string>[] = [];
    if (extractedMetadata.tags && extractedMetadata.tags.length > 0) {
      const tagResults = await this.tagsService.findOrSuggestTags(
        project.id,
        extractedMetadata.tags,
        attachment.uploadedByUserId
      );
      mappedTags = tagResults.map(({ tag }) => ({
        publicId: tag.publicId,
        tagName: tag.tagName,
      }));
      // บันทึก Tag ใหม่ที่ไม่มีในระบบเป็น aiIssues เพื่อให้มนุษย์ตรวจสอบ
      for (const { tag, isNew } of tagResults) {
        if (isNew) {
          aiIssues.push({
            type: 'NEW_TAG_SUGGESTED',
            tagPublicId: tag.publicId,
            tagName: tag.tagName,
            message: `Tag '${tag.tagName}' ถูกสร้างใหม่โดย AI — ต้องการการตรวจสอบจากมนุษย์`,
          });
        }
      }
    }
    const confidence =
      typeof extractedMetadata.confidence === 'number'
        ? extractedMetadata.confidence
        : 0.5;

    // 4. Resolve UUIDs of Sender/Recipient Organizations to Database IDs (ADR-019)
    // EC-002: UUID ที่หาไม่พบใน Master Data จะถูก flag ใน aiIssues และ isValid = false
    let senderOrgId: number | undefined = undefined;
    if (extractedMetadata.originatorOrganizationPublicId) {
      const foundOrg = await this.attachmentRepo.manager
        .createQueryBuilder()
        .select('org.id', 'id')
        .from('organizations', 'org')
        .where('org.uuid = :uuid', {
          uuid: extractedMetadata.originatorOrganizationPublicId,
        })
        .getRawOne<{ id: number }>();
      if (foundOrg) {
        senderOrgId = Number(foundOrg.id);
      } else {
        // EC-002: UUID ของผู้ส่งไม่มีใน Master Data — flag เพื่อ human review
        aiIssues.push({
          type: 'UNRESOLVED_SENDER_UUID',
          uuid: extractedMetadata.originatorOrganizationPublicId,
          message: `UUID ผู้ส่ง '${extractedMetadata.originatorOrganizationPublicId}' ไม่พบใน Master Data — ต้องการการตรวจสอบจากมนุษย์`,
        });
      }
    }

    let primaryReceiverOrgId: number | undefined = undefined;
    if (
      extractedMetadata.recipients &&
      extractedMetadata.recipients.length > 0
    ) {
      // ดึงผู้รับที่เป็นประเภท TO รายแรกเป็นผู้รับหลัก (Primary Receiver)
      const primaryReceiverObj =
        extractedMetadata.recipients.find((r) => r.recipientType === 'TO') ||
        extractedMetadata.recipients[0];
      const foundOrg = await this.attachmentRepo.manager
        .createQueryBuilder()
        .select('org.id', 'id')
        .from('organizations', 'org')
        .where('org.uuid = :uuid', {
          uuid: primaryReceiverObj.organizationPublicId,
        })
        .getRawOne<{ id: number }>();
      if (foundOrg) {
        primaryReceiverOrgId = Number(foundOrg.id);
      } else {
        // EC-002: UUID ของผู้รับไม่มีใน Master Data — flag เพื่อ human review
        aiIssues.push({
          type: 'UNRESOLVED_RECIPIENT_UUID',
          uuid: primaryReceiverObj.organizationPublicId,
          message: `UUID ผู้รับ '${primaryReceiverObj.organizationPublicId}' ไม่พบใน Master Data — ต้องการการตรวจสอบจากมนุษย์`,
        });
      }
    }

    // 5. ดึงประเภทเอกสารโต้ตอบ (Category Type) และสาขางาน (Discipline)
    let matchedCategory = 'Correspondence';
    if (extractedMetadata.correspondenceTypeCode) {
      const foundType = await this.attachmentRepo.manager
        .createQueryBuilder()
        .select('t.type_name', 'name')
        .from('correspondence_types', 't')
        .where('t.type_code = :code', {
          code: extractedMetadata.correspondenceTypeCode,
        })
        .getRawOne<{ name: string }>();
      if (foundType) {
        matchedCategory = foundType.name;
      }
    }

    let matchedDisciplineId: number | undefined = undefined;
    if (extractedMetadata.disciplineCode) {
      const foundDisp = await this.attachmentRepo.manager
        .createQueryBuilder()
        .select('d.id', 'id')
        .from('disciplines', 'd')
        .where('d.discipline_code = :code', {
          code: extractedMetadata.disciplineCode,
        })
        .getRawOne<{ id: number }>();
      if (foundDisp) {
        matchedDisciplineId = Number(foundDisp.id);
      }
    }

    // 6. ส่งบันทึกเข้าสู่ Review Queue พร้อมคืนค่าผู้รับ Object Array ใน JSON metadata details
    // EC-002: หากมี UUID ที่ไม่สามารถ resolve ได้ ให้ isValid = false เพื่อส่งเข้า review เสมอ
    const hasUnresolvedUuids = aiIssues.some(
      (issue) =>
        issue.type === 'UNRESOLVED_SENDER_UUID' ||
        issue.type === 'UNRESOLVED_RECIPIENT_UUID'
    );
    const isValid = confidence >= 0.6 && !!docNumber && !hasUnresolvedUuids;
    const payloadTitle = readString(payload.title);

    await this.migrationService.enqueueRecord({
      documentNumber: docNumber,
      subject: extractedMetadata.subject || payloadTitle,
      originalSubject: payloadTitle,
      body: extractedMetadata.summary || '',
      category: matchedCategory,
      aiSummary: extractedMetadata.summary || '',
      projectId: project.id,
      senderOrgId: senderOrgId || readNumberId(payload.senderOrgId),
      receiverOrgId:
        primaryReceiverOrgId || readNumberId(payload.receiverOrgId),
      issuedDate: extractedMetadata.documentDate || undefined,
      receivedDate: extractedMetadata.documentDate || undefined,
      extractedTags: mappedTags,
      tempAttachmentId: attachment.id,
      isValid,
      confidence,
      aiJobId: String(job.id),
      aiIssues: aiIssues.length > 0 ? aiIssues : undefined,
      details: {
        disciplineCode: extractedMetadata.disciplineCode,
        disciplineId: matchedDisciplineId,
        recipientsList: extractedMetadata.recipients, // บันทึก Object Array สกัดใหม่
      },
    });

    await this.saveAiAuditLog({
      documentPublicId,
      aiModel: this.ollamaService.getMainModelName(),
      status: AiAuditStatus.SUCCESS,
      aiSuggestionJson: extractedMetadata as unknown as Record<string, unknown>,
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
