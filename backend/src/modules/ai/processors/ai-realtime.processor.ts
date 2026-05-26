// File: src/modules/ai/processors/ai-realtime.processor.ts
// Change Log
// - 2026-05-15: เพิ่ม processor สำหรับ ai-realtime queue และ pause/resume ai-batch ตาม ADR-023A.

import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
  InjectQueue,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QUEUE_AI_BATCH,
  QUEUE_AI_REALTIME,
} from '../../common/constants/queue.constants';
import { AiAuditLog, AiAuditStatus } from '../entities/ai-audit-log.entity';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { OcrService } from '../services/ocr.service';
import { OllamaService } from '../services/ollama.service';

export type AiRealtimeJobType = 'ai-suggest' | 'rag-query';

export interface AiRealtimeJobData {
  jobType: AiRealtimeJobType;
  documentPublicId?: string;
  projectPublicId: string;
  userId?: number;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

/** Processor สำหรับงาน AI interactive ที่ต้องกัน batch job ระหว่างใช้ GPU */
@Processor(QUEUE_AI_REALTIME, { concurrency: 1 })
export class AiRealtimeProcessor extends WorkerHost {
  private readonly logger = new Logger(AiRealtimeProcessor.name);

  constructor(
    @InjectQueue(QUEUE_AI_BATCH)
    private readonly aiBatchQueue: Queue,
    private readonly ocrService: OcrService,
    private readonly ollamaService: OllamaService,
    @InjectRepository(AiAuditLog)
    private readonly aiAuditLogRepo: Repository<AiAuditLog>,
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>
  ) {
    super();
  }

  /** Dispatch งาน ai-realtime ตาม jobType */
  async process(job: Job<AiRealtimeJobData>): Promise<unknown> {
    switch (job.data.jobType) {
      case 'ai-suggest':
        return this.processSuggest(job);
      case 'rag-query':
        this.logger.log(`RAG query queued — jobId=${String(job.id)}`);
        return;
      default: {
        const unreachable: never = job.data.jobType;
        throw new Error(
          `Unsupported ai-realtime jobType: ${String(unreachable)}`
        );
      }
    }
  }

  private async processSuggest(
    job: Job<AiRealtimeJobData>
  ): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    try {
      if (job.data.documentPublicId) {
        await this.setAiProcessingStatus(
          job.data.documentPublicId,
          'PROCESSING'
        );
      }
      const extractedText =
        typeof job.data.payload['extractedText'] === 'string'
          ? job.data.payload['extractedText']
          : '';
      const pdfPath =
        typeof job.data.payload['pdfPath'] === 'string'
          ? job.data.payload['pdfPath']
          : undefined;
      const extractedChars =
        typeof job.data.payload['extractedChars'] === 'number'
          ? job.data.payload['extractedChars']
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
      const normalizedSuggestion = this.flagUnknownCategories(
        suggestion,
        job.data.payload['masterDataCategories']
      );

      await this.aiAuditLogRepo.save(
        this.aiAuditLogRepo.create({
          documentPublicId: job.data.documentPublicId,
          aiModel: 'gemma4',
          modelName: this.ollamaService.getMainModelName(),
          aiSuggestionJson: normalizedSuggestion,
          confidenceScore: this.extractConfidence(normalizedSuggestion),
          processingTimeMs: Date.now() - startTime,
          status: AiAuditStatus.SUCCESS,
        })
      );
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
      await this.aiAuditLogRepo.save(
        this.aiAuditLogRepo.create({
          documentPublicId: job.data.documentPublicId,
          aiModel: 'gemma4',
          modelName: this.ollamaService.getMainModelName(),
          processingTimeMs: Date.now() - startTime,
          status: AiAuditStatus.FAILED,
          errorMessage: err instanceof Error ? err.message : String(err),
        })
      );
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

  private async setAiProcessingStatus(
    documentPublicId: string,
    status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'
  ): Promise<void> {
    await this.attachmentRepo.update(
      { publicId: documentPublicId },
      { aiProcessingStatus: status }
    );
  }

  /** เมื่อ interactive job เริ่ม ให้ pause batch queue เพื่อกัน GPU contention */
  @OnWorkerEvent('active')
  async onActive(job: Job<AiRealtimeJobData>): Promise<void> {
    await this.aiBatchQueue.pause();
    this.logger.warn(
      `ai-batch paused while ai-realtime job is active — jobId=${String(job.id)}`
    );
  }

  /** เมื่อ interactive job เสร็จ ให้ resume batch queue */
  @OnWorkerEvent('completed')
  async onCompleted(job: Job<AiRealtimeJobData>): Promise<void> {
    await this.aiBatchQueue.resume();
    this.logger.log(
      `ai-batch resumed after ai-realtime completion — jobId=${String(job.id)}`
    );
  }

  /** เมื่อ interactive job fail ให้ resume batch queue เช่นกัน */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<AiRealtimeJobData> | undefined): Promise<void> {
    await this.aiBatchQueue.resume();
    this.logger.warn(
      `ai-batch resumed after ai-realtime failure — jobId=${String(job?.id ?? 'unknown')}`
    );
  }
}
