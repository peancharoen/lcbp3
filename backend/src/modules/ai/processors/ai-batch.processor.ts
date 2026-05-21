// File: src/modules/ai/processors/ai-batch.processor.ts
// Change Log
// - 2026-05-15: เพิ่ม processor สำหรับ ai-batch queue ตาม ADR-023A.
// - 2026-05-15: เพิ่ม EmbeddingService สำหรับ embed-document logic (T022).
// - 2026-05-21: เพิ่มการรองรับ sandbox-rag และ sandbox-extract สำหรับ Superadmin sandbox.
// - 2026-05-21: พัฒนาระบบประมวลผล sandbox-extract พร้อมเชื่อมต่อ OcrService, OllamaService และ Redis cache
// - 2026-05-21: แก้ไข ESLint unused variable สำหรับ parseError ใน catch block

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

export type AiBatchJobType =
  | 'ocr'
  | 'extract-metadata'
  | 'embed-document'
  | 'sandbox-rag'
  | 'sandbox-extract';

export interface AiBatchJobData {
  jobType: AiBatchJobType;
  documentPublicId: string;
  projectPublicId: string;
  payload: Record<string, unknown>;
  batchId?: string;
  idempotencyKey: string;
}

/** Processor สำหรับงาน AI batch ที่รันทีละงานเพื่อคุม VRAM */
@Processor(QUEUE_AI_BATCH, { concurrency: 1 })
export class AiBatchProcessor extends WorkerHost {
  private readonly logger = new Logger(AiBatchProcessor.name);
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    private readonly embeddingService: EmbeddingService,
    private readonly ragService: AiRagService,
    private readonly ocrService: OcrService,
    private readonly ollamaService: OllamaService,
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
      const prompt = `You are an expert document extraction system.
Analyze the following OCR text extracted from a project document and extract the metadata fields.

OCR TEXT:
${ocrResult.text}

Extract these fields:
1. documentNumber: The official document number or code. If not found, return null.
2. subject: The main subject, title, or topic of the document. If not found, return null.
3. discipline: Must be exactly one of: "Civil", "Mechanical", "Electrical", "Architectural", or null if not specified.
4. date: The issue date in YYYY-MM-DD format. If not found, return null.
5. confidence: A float between 0.0 and 1.0 indicating your confidence in this extraction.

Return ONLY a valid JSON object matching this schema. Do NOT include markdown code blocks, HTML, or any conversational text. Example:
{
  "documentNumber": "LCBP3-CIV-001",
  "subject": "Foundation Inspection Report",
  "discipline": "Civil",
  "date": "2026-05-20",
  "confidence": 0.95
}`;
      const response = await this.ollamaService.generate(prompt);
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
      await this.redis.setex(
        `ai:rag:result:${idempotencyKey}`,
        3600,
        JSON.stringify({
          requestPublicId: idempotencyKey,
          status: 'completed',
          answer: JSON.stringify(extractedMetadata, null, 2),
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
}
