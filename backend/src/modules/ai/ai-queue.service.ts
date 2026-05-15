// File: src/modules/ai/ai-queue.service.ts
// Change Log
// - 2026-05-14: เพิ่ม service กลางสำหรับส่งงาน AI เข้า BullMQ ตาม ADR-023.
// - 2026-05-14: เพิ่ม JSDoc idempotency contract สำหรับทุก enqueue method (💡 S3).
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import {
  QUEUE_AI_INGEST,
  QUEUE_AI_RAG,
  QUEUE_AI_VECTOR_DELETION,
} from '../common/constants/queue.constants';

/** Payload สำหรับงาน ingest เอกสารเก่าเข้า AI Pipeline */
export interface AiIngestJobPayload {
  batchId: string;
  filePublicIds: string[];
  source: 'api' | 'folder-watcher';
}

/** Payload สำหรับงาน RAG Query ที่ต้องเข้าคิวบน Desk-5439 */
export interface AiRagJobPayload {
  requestPublicId: string;
  userPublicId: string;
  projectPublicId: string;
  query: string;
}

/** Payload สำหรับลบ vector ใน Qdrant แบบ eventual consistency */
export interface AiVectorDeletionJobPayload {
  documentPublicId: string;
  requestedByUserPublicId: string;
}

/** จัดการคิว AI ทั้งหมดให้อยู่หลัง BullMQ ตาม ADR-008/ADR-023 */
@Injectable()
export class AiQueueService {
  private readonly defaultOptions: JobsOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 200,
  };

  constructor(
    @InjectQueue(QUEUE_AI_INGEST)
    private readonly ingestQueue: Queue<AiIngestJobPayload>,
    @InjectQueue(QUEUE_AI_RAG)
    private readonly ragQueue: Queue<AiRagJobPayload>,
    @InjectQueue(QUEUE_AI_VECTOR_DELETION)
    private readonly vectorDeletionQueue: Queue<AiVectorDeletionJobPayload>
  ) {}

  /**
   * ส่ง batch migration เข้า queue เพื่อไม่ให้ request thread ทำงานหนัก
   * @idempotency `jobId = batchId:source` — การส่ง batch เดิมซ้ำจะคืน job ID เดิม ไม่สร้างงานใหม่
   */
  async enqueueIngest(payload: AiIngestJobPayload): Promise<string> {
    const job = await this.ingestQueue.add('legacy-migration-ingest', payload, {
      ...this.defaultOptions,
      jobId: `${payload.batchId}:${payload.source}`,
    });
    return String(job.id);
  }

  /**
   * ส่ง RAG query เข้า queue ที่ processor จะกำหนด concurrency = 1
   * @idempotency `jobId = requestPublicId` — ถ้า request เดิม (UUID เดียวกัน) ถูก submit ซ้ำ BullMQ จะไม่สร้างงานใหม่
   */
  async enqueueRagQuery(payload: AiRagJobPayload): Promise<string> {
    const job = await this.ragQueue.add('rag-query', payload, {
      ...this.defaultOptions,
      jobId: payload.requestPublicId,
    });
    return String(job.id);
  }

  /**
   * ส่งคำสั่งลบ vector เข้า queue เพื่อ retry ได้เมื่อ Qdrant ไม่พร้อม
   * @idempotency `jobId = documentPublicId` — การลบเอกสารเดิมซ้ำจะถูก de-duplicate โดย BullMQ
   */
  async enqueueVectorDeletion(
    payload: AiVectorDeletionJobPayload
  ): Promise<string> {
    const job = await this.vectorDeletionQueue.add(
      'delete-document-vectors',
      payload,
      {
        ...this.defaultOptions,
        jobId: payload.documentPublicId,
      }
    );
    return String(job.id);
  }
}
