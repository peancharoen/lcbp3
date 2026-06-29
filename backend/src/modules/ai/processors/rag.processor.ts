// File: src/modules/ai/processors/rag.processor.ts
// Change Log
// - 2026-05-14: เพิ่ม BullMQ Processor สำหรับ RAG query ตาม ADR-023 Phase 4 (T018, T022).
// Processor นี้ใช้ concurrency = 1 เพื่อป้องกัน OOM บน Desk-5439 (FR-009)

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiRagService } from '../ai-rag.service';
import { AiRagJobPayload } from '../ai-queue.service';
import { QUEUE_AI_RAG } from '../../common/constants/queue.constants';

/**
 * Processor สำหรับ RAG query queue
 * - concurrency: 1 เพื่อป้องกัน VRAM overflow บน Desk-5439 (FR-009, Research Unknown 3)
 * - รองรับ AbortController เพื่อยกเลิก LLM generation เมื่อ client disconnect (T022, FR-011)
 */
@Processor(QUEUE_AI_RAG, { concurrency: 1 })
export class AiRagProcessor extends WorkerHost {
  private readonly logger = new Logger(AiRagProcessor.name);

  /** Map สำหรับเก็บ AbortController ของแต่ละ job (T022) */
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(private readonly ragService: AiRagService) {
    super();
  }

  /** ประมวลผล RAG query job */
  async process(job: Job<AiRagJobPayload>): Promise<void> {
    const { requestPublicId, userPublicId, projectPublicId, query } = job.data;
    this.logger.log(
      `Processing RAG job — requestPublicId=${requestPublicId}, user=${userPublicId}`
    );

    // สร้าง AbortController สำหรับ job นี้ (T022)
    const controller = new AbortController();
    this.abortControllers.set(requestPublicId, controller);

    try {
      await this.ragService.processQuery(
        requestPublicId,
        query,
        projectPublicId,
        userPublicId,
        controller.signal
      );
    } finally {
      this.abortControllers.delete(requestPublicId);
    }
  }

  /**
   * Abort การประมวลผล LLM สำหรับ job ที่ระบุ (T022 — FR-011)
   * ถูกเรียกจาก AiRagService.cancelJob() ผ่าน Redis cancel flag
   */
  abortJob(requestPublicId: string): boolean {
    const controller = this.abortControllers.get(requestPublicId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestPublicId);
      this.logger.log(`Aborted RAG job — requestPublicId=${requestPublicId}`);
      return true;
    }
    return false;
  }

  /** Log เมื่อ job เสร็จสมบูรณ์ */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<AiRagJobPayload>): void {
    this.logger.log(
      `RAG job completed — jobId=${String(job.id)}, requestPublicId=${job.data.requestPublicId}`
    );
  }

  /** Log และ cleanup เมื่อ job ล้มเหลว */
  @OnWorkerEvent('failed')
  onFailed(job: Job<AiRagJobPayload> | undefined, err: Error): void {
    const id = job?.data?.requestPublicId ?? 'unknown';
    // ยกเลิก abort controller ที่ค้างไว้
    if (job?.data?.requestPublicId) {
      this.abortControllers.delete(job.data.requestPublicId);
    }
    this.logger.error(`RAG job failed — requestPublicId=${id}: ${err.message}`);
  }
}
