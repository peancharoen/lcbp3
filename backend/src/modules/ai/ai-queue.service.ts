// File: src/modules/ai/ai-queue.service.ts
// Change Log
// - 2026-05-14: เพิ่ม service กลางสำหรับส่งงาน AI เข้า BullMQ ตาม ADR-023.
// - 2026-05-14: เพิ่ม JSDoc idempotency contract สำหรับทุก enqueue method (💡 S3).
// - 2026-05-21: เพิ่มการลงทะเบียน QUEUE_AI_BATCH และ enqueueSandboxJob สำหรับ Superadmin sandbox.
// - 2026-05-21: แก้ไข ESLint error โดยการเปลี่ยน Queue<any> เป็น Queue<unknown> สำหรับ batchQueue
// - 2026-06-14: เพิ่ม sandbox-rag-prep ใน enqueueSandboxJob (T039)
// - 2026-08-24: ADR-048 T003 — เพิ่ม single choke-point mutex lock check ในทุก enqueue* method
//   ตรวจสอบ Redis key ai:model:transitioning (TTL 15s) ก่อน queue.add()
//   ถ้า lock สับ throw SystemException (503) ตาม ADR-007
// - 2026-09-04: เพิ่ม lock ที่สอง ai:ocr-batch:active (heartbeat แทน fixed TTL สั้น) สำหรับ
//   two-phase batch OCR/AI extraction — ระหว่าง phase OCR ทั้ง batch main model ถูก unload
//   ค้างไว้นานกว่า 15s ปกติมาก จึงแยก lock คนละดวงจาก ai:model:transitioning (ADR-048 เดิม
//   ออกแบบมาสำหรับการสลับโมเดลสั้นๆ เท่านั้น) — เปลี่ยนชื่อ checkModelTransitioningLock →
//   checkAiUnavailableLocks ให้เช็คทั้งสอง key (OR) โดย enqueue* call sites เดิมไม่ต้องแก้ไข
//   Bugfix ที่พบระหว่างทาง: เดิม throw raw HttpException พร้อม custom `code` field เอง แต่
//   GlobalExceptionFilter (global-exception.filter.ts) เช็ค `instanceof BaseException` ก่อน
//   — raw HttpException ที่ไม่ใช่ BaseException จะถูก overwrite `code` เป็น 'HTTP_ERROR' เสมอ
//   (ดู mapStatusToErrorType/ไม่มีการอ่าน custom code เลย) ทำให้ frontend interceptor
//   (`code === 'AI_FEATURES_UNAVAILABLE'`) ไม่เคย match มาตั้งแต่แรก แก้โดยเปลี่ยนไปใช้
//   ServiceUnavailableException (BaseException subclass, เหมือน ai-enabled.guard.ts) แทน
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Queue, JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { v7 as uuidv7 } from 'uuid';
import {
  QUEUE_AI_INGEST,
  QUEUE_AI_RAG,
  QUEUE_AI_VECTOR_DELETION,
  QUEUE_AI_BATCH,
  QUEUE_AI_REALTIME,
} from '../common/constants/queue.constants';
import { QueueJobItemDto } from './dto/queue-jobs.dto';
import { ServiceUnavailableException } from '../../common/exceptions';

/** Redis key สำหรับ mutex lock ระหว่าง Ollama model Load/Unload (ADR-048) */
const REDIS_KEY_MODEL_TRANSITIONING = 'ai:model:transitioning';

/**
 * Redis key สำหรับ lock "กำลังรัน OCR phase ของทั้ง batch อยู่" — คนละดวงกับ
 * REDIS_KEY_MODEL_TRANSITIONING เพราะ phase นี้ยาวเป็นนาที (loop หลายเอกสาร) ไม่ใช่การสลับ
 * โมเดลสั้นๆ แบบ ADR-048 เดิม จึงใช้ heartbeat (ต่ออายุ TTL เป็นระยะ) แทน fixed TTL 15s
 */
const REDIS_KEY_OCR_BATCH_ACTIVE = 'ai:ocr-batch:active';
/** TTL ของ ai:ocr-batch:active — เป็น crash safety net เท่านั้น ต้อง heartbeat ต่ออายุก่อนหมด */
const OCR_BATCH_LOCK_TTL_SECONDS = 30;

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
  projectPublicId: string;
  requestedByUserPublicId: string;
}

/** Payload สำหรับงาน RAG Prepare เมื่อผู้ใช้ submit workflow */
export interface RagPrepareJobPayload {
  documentPublicId: string;
  projectPublicId: string;
  correspondenceNumber: string;
  docType: string;
  statusCode: string;
  revisionNumber: number;
  subject: string;
  documentDate?: string;
  cachedOcrText?: string;
  attachmentPath?: string;
  attachmentPublicId?: string;
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
    private readonly vectorDeletionQueue: Queue<AiVectorDeletionJobPayload>,
    @InjectQueue(QUEUE_AI_BATCH)
    private readonly batchQueue: Queue<unknown>,
    @InjectQueue(QUEUE_AI_REALTIME)
    private readonly realtimeQueue: Queue<unknown>,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /**
   * ตรวจสอบว่า Ollama กำลังอยู่ระหว่างเปลี่ยน model หรือกำลังรัน OCR batch phase อยู่หรือไม่
   * (TOCTOU guard) — ถ้ามี lock ใดสับ แสดงว่า main model ไม่พร้อมใช้งานชั่วคราว throw 503
   * เพื่อให้ frontend แสดง dialog รอ/ยกเลิกแล้วให้ client retry เอง
   * @throws HttpException (503, code AI_FEATURES_UNAVAILABLE) ถ้ามี lock ใดสับอยู่
   */
  private async checkAiUnavailableLocks(): Promise<void> {
    const [modelTransitioning, ocrBatchActive] = await Promise.all([
      this.redis.get(REDIS_KEY_MODEL_TRANSITIONING),
      this.redis.get(REDIS_KEY_OCR_BATCH_ACTIVE),
    ]);
    if (modelTransitioning || ocrBatchActive) {
      throw new ServiceUnavailableException(
        'AI_FEATURES_UNAVAILABLE',
        ocrBatchActive
          ? 'OCR batch phase is running — main model is unloaded'
          : 'Ollama model is transitioning (load/unload in progress)',
        ocrBatchActive
          ? 'ระบบกำลังประมวลผล OCR แบบชุด (batch) อยู่ กรุณารอสักครู่แล้วลองใหม่'
          : 'ระบบ AI กำลังอยู่ระหว่างเปลี่ยนโมเดล กรุณาลองอีกครั้งในอีกไม่กี่วินาที',
        ocrBatchActive
          ? ['รอจนกว่า batch OCR จะเสร็จแล้วลองใหม่']
          : ['รอประมาณ 15 วินาทีแล้วลองใหม่']
      );
    }
  }

  /**
   * ADR-050 (two-phase batch OCR/AI) — acquire lock "OCR batch phase active" ด้วย atomic
   * SET NX EX + ownership token (pattern เดียวกับ vram-monitor.service.ts ADR-048 FR-009)
   * ผู้เรียกต้อง heartbeat ต่ออายุเป็นระยะระหว่างรัน batch แล้วเรียก release เมื่อจบ phase
   * @returns ownership token ถ้า acquire สำเร็จ, null ถ้ามี batch อื่นกำลังรันอยู่แล้ว
   */
  async acquireOcrBatchLock(): Promise<string | null> {
    const lockToken = `ocr-batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.redis.set(
      REDIS_KEY_OCR_BATCH_ACTIVE,
      lockToken,
      'EX',
      OCR_BATCH_LOCK_TTL_SECONDS,
      'NX'
    );
    return acquired ? lockToken : null;
  }

  /**
   * ต่ออายุ lock "OCR batch phase active" — เรียกเป็นระยะ (เช่นทุกเอกสารใน loop) ระหว่างรัน
   * batch เพื่อไม่ให้ TTL หมดอายุก่อน phase เสร็จจริง เช็ค ownership token ก่อนต่ออายุเสมอ
   */
  async heartbeatOcrBatchLock(lockToken: string): Promise<void> {
    const currentToken = await this.redis.get(REDIS_KEY_OCR_BATCH_ACTIVE);
    if (currentToken === lockToken) {
      await this.redis.expire(
        REDIS_KEY_OCR_BATCH_ACTIVE,
        OCR_BATCH_LOCK_TTL_SECONDS
      );
    }
  }

  /**
   * ปล่อย lock "OCR batch phase active" เฉพาะเมื่อ ownership token ตรงกัน (ป้องกันการลบ lock
   * ของ batch อื่นที่อาจ acquire ได้หลังจาก TTL ของเราหมดอายุไปแล้ว)
   */
  async releaseOcrBatchLock(lockToken: string): Promise<void> {
    const currentToken = await this.redis.get(REDIS_KEY_OCR_BATCH_ACTIVE);
    if (currentToken === lockToken) {
      await this.redis.del(REDIS_KEY_OCR_BATCH_ACTIVE);
    }
  }

  /**
   * ส่ง batch migration เข้า queue เพื่อไม่ให้ request thread ทำงานหนัก
   * @idempotency `jobId = batchId:source` — การส่ง batch เดิมซ้ำจะคืน job ID เดิม ไม่สร้างงานใหม่
   */
  async enqueueIngest(payload: AiIngestJobPayload): Promise<string> {
    await this.checkAiUnavailableLocks();
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
    await this.checkAiUnavailableLocks();
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
    await this.checkAiUnavailableLocks();
    const job = await this.vectorDeletionQueue.add(
      'delete-document-vectors',
      payload,
      {
        ...this.defaultOptions,
        jobId: `${payload.projectPublicId}-${payload.documentPublicId}`,
      }
    );
    return String(job.id);
  }

  /**
   * ส่ง sandbox job เข้า queue ai-batch โดยกำหนด priority = 1 เพื่อความรวดเร็วสำหรับ Superadmin
   * @idempotency `jobId = payload.idempotencyKey`
   */
  async enqueueSandboxJob(
    jobType:
      | 'sandbox-rag'
      | 'sandbox-extract'
      | 'sandbox-ocr-only'
      | 'sandbox-ai-extract'
      | 'sandbox-rag-prep',
    payload: {
      idempotencyKey: string;
      projectPublicId?: string;
      contractPublicId?: string;
      query?: string;
      userPublicId?: string;
      filePublicId?: string;
      pdfPath?: string;
      engineType?: string;
      ocrOptions?: {
        temperature?: number;
        topP?: number;
        repeatPenalty?: number;
      };
      extraPayload?: Record<string, unknown>;
    }
  ): Promise<string> {
    await this.checkAiUnavailableLocks();
    const job = await this.batchQueue.add(
      jobType,
      {
        jobType,
        documentPublicId: payload.idempotencyKey,
        projectPublicId: payload.projectPublicId ?? '',
        payload: {
          query: payload.query,
          userPublicId: payload.userPublicId,
          filePublicId: payload.filePublicId,
          pdfPath: payload.pdfPath,
          engineType: payload.engineType,
          ocrOptions: payload.ocrOptions,
          contractPublicId: payload.contractPublicId,
          ...payload.extraPayload,
        },
        idempotencyKey: payload.idempotencyKey,
      },
      {
        ...this.defaultOptions,
        priority: 1,
        jobId: payload.idempotencyKey,
      }
    );
    return String(job.id);
  }

  /**
   * ดึงจำนวนงานที่กำลังประมวลผลอยู่หรือกำลังรอคิวใน batchQueue เพื่อคำนวณ rate limiting แบบไดนามิก
   */
  async getBatchQueueSize(): Promise<number> {
    const active = await this.batchQueue.getActiveCount();
    const waiting = await this.batchQueue.getWaitingCount();
    return active + waiting;
  }

  /**
   * ADR-048 FR-007 — ดึงจำนวนงานที่กำลังประมวลผลอยู่หรือกำลังรอคิวใน realtimeQueue
   * ใช้สำหรับ empty-queue guard ใน load/unload model
   */
  async getRealtimeQueueSize(): Promise<number> {
    const active = await this.realtimeQueue.getActiveCount();
    const waiting = await this.realtimeQueue.getWaitingCount();
    return active + waiting;
  }

  /**
   * ADR-048 FR-007 — ตรวจสอบว่าทั้ง ai-batch และ ai-realtime ว่างจาก active/waiting jobs
   * @throws HttpException (409) ถ้ามี jobs ใน queue ใด queue หนึ่ง
   */
  async assertQueuesEmpty(): Promise<void> {
    const [batchSize, realtimeSize] = await Promise.all([
      this.getBatchQueueSize(),
      this.getRealtimeQueueSize(),
    ]);
    const totalActive = batchSize + realtimeSize;
    if (totalActive > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          message: 'Conflict',
          userMessage: `ไม่สามารถดำเนินการได้: ยังมีงาน AI ${totalActive} รายการรอประมวลผลอยู่ (batch=${batchSize}, realtime=${realtimeSize})`,
          recoveryAction: 'รอให้ queue ว่างก่อนแล้วลองอีกครั้ง',
        },
        HttpStatus.CONFLICT
      );
    }
  }

  /**
   * ส่งงาน RAG Prepare เข้า queue เพื่อเตรียมหั่นข้อมูลและทำ embedding ในเบื้องหลัง
   * @idempotency `jobId = rag-prepare:${documentPublicId}:${revisionNumber}` — ป้องกันการรันซ้ำสำหรับ revision เดียวกัน
   */
  async enqueueRagPrepare(payload: RagPrepareJobPayload): Promise<string> {
    await this.checkAiUnavailableLocks();
    const job = await this.batchQueue.add(
      'rag-prepare',
      {
        jobType: 'rag-prepare',
        ...payload,
      },
      {
        ...this.defaultOptions,
        jobId: `rag-prepare:${payload.documentPublicId}:${payload.revisionNumber}`,
      }
    );
    return String(job.id);
  }

  /**
   * ส่งงาน embed-document เข้า queue แยกจาก rag-prepare เพื่อให้ OCR text ถูก persist ก่อน
   * แล้ว enqueue ต่อไป embedding ที่รับ extractedText โดยตรง (ADR-042)
   * @idempotency `jobId = embed-document:${documentPublicId}:${revisionNumber}` — แยกจาก rag-prepare เพื่อไม่ชนกัน
   */
  async enqueueEmbedDocument(payload: {
    documentPublicId: string;
    projectPublicId: string;
    correspondenceNumber: string;
    docType: string;
    statusCode: string;
    revisionNumber: number;
    subject: string;
    documentDate?: string;
    extractedText: string;
    pdfPath?: string;
  }): Promise<string> {
    await this.checkAiUnavailableLocks();
    const job = await this.batchQueue.add(
      'embed-document',
      {
        jobType: 'embed-document',
        documentPublicId: payload.documentPublicId,
        projectPublicId: payload.projectPublicId,
        payload: {
          pdfPath: payload.pdfPath,
          extractedText: payload.extractedText,
          correspondenceNumber: payload.correspondenceNumber,
          docType: payload.docType,
          statusCode: payload.statusCode,
          revisionNumber: payload.revisionNumber,
          subject: payload.subject,
          documentDate: payload.documentDate,
        },
        idempotencyKey: `embed-document:${payload.documentPublicId}:${payload.revisionNumber}`,
      },
      {
        ...this.defaultOptions,
        jobId: `embed-document:${payload.documentPublicId}:${payload.revisionNumber}`,
      }
    );
    return String(job.id);
  }

  // ─── ADR-048 T014: Queue Job Inspection, Retry, Delete ─────────────────────

  /**
   * ดึงรายการ jobs จาก queue ที่กำหนด พร้อม pagination และ status filter
   * รองรับ queue ชื่อ 'ai-batch' และ 'ai-realtime'
   * @param queueName ชื่อ queue (ai-batch | ai-realtime)
   * @param status สถานะ job (all, active, waiting, failed, completed, delayed)
   * @param page หน้าที่ต้องการ (1-indexed)
   * @param limit จำนวนรายการต่อหน้า (max 100)
   */
  async getQueueJobs(
    queueName: string,
    status: 'all' | 'active' | 'waiting' | 'failed' | 'completed' | 'delayed',
    page: number,
    limit: number
  ): Promise<{ jobs: QueueJobItemDto[]; total: number }> {
    const queue = this.getQueueByName(queueName);
    const offset = (page - 1) * limit;

    // BullMQ jobs() รับ array ของ type
    const jobTypes: Array<
      'active' | 'waiting' | 'failed' | 'completed' | 'delayed'
    > =
      status === 'all'
        ? ['active', 'waiting', 'failed', 'completed', 'delayed']
        : [status];

    const allJobs = await queue.getJobs(jobTypes, offset, offset + limit - 1);
    const total = await queue.getJobCountByTypes(...jobTypes);

    const items = allJobs.map((j) => {
      const item = new QueueJobItemDto();
      item.id = String(j.id);
      item.name = j.name;
      item.jobType =
        ((j.data as Record<string, unknown>)?.jobType as string) ?? j.name;
      item.status = j.finishedOn
        ? j.failedReason
          ? 'failed'
          : 'completed'
        : j.processedOn
          ? 'active'
          : 'waiting';
      // ส่งเฉพาะ field ที่ปลอดภัย (ไม่รวม credentials/paths)
      item.data = {
        documentPublicId: (j.data as Record<string, unknown>)?.documentPublicId,
        projectPublicId: (j.data as Record<string, unknown>)?.projectPublicId,
        jobType: item.jobType,
      };
      item.failedReason = j.failedReason ?? undefined;
      item.stacktrace = j.stacktrace?.slice(0, 3);
      item.attemptsMade = j.attemptsMade;
      item.createdAt = j.timestamp;
      item.processedOn = j.processedOn ?? undefined;
      item.finishedOn = j.finishedOn ?? undefined;
      return item;
    });

    return { jobs: items, total };
  }

  /**
   * Retry job ที่ล้มเหลวใน queue ที่กำหนด
   * @param queueName ชื่อ queue
   * @param jobId BullMQ job ID
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: `Job ${jobId} not found in queue ${queueName}`,
        },
        HttpStatus.NOT_FOUND
      );
    }
    await job.retry();
  }

  /**
   * ลบ job ออกจาก queue
   * @param queueName ชื่อ queue
   * @param jobId BullMQ job ID
   */
  async deleteJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: `Job ${jobId} not found in queue ${queueName}`,
        },
        HttpStatus.NOT_FOUND
      );
    }
    await job.remove();
  }

  /**
   * Enqueue async clear-failed-jobs task สำหรับ queue ที่กำหนด
   * บันทึก status เริ่มต้นลง Redis key ai:clear_failed:job:<trackingId>
   * Processor จะ update status ผ่าน Redis เมื่อเสร็จ
   * @param queueName ชื่อ queue ที่ต้องการ clear failed jobs
   * @param requestedByUserPublicId publicId ของผู้สั่ง
   * @returns trackingId สำหรับ poll progress
   */
  async enqueueClearFailed(
    queueName: string,
    requestedByUserPublicId: string
  ): Promise<string> {
    await this.checkAiUnavailableLocks();
    const trackingId = `cf-${queueName}-${uuidv7()}`;
    const statusKey = `ai:clear_failed:job:${trackingId}`;

    // บันทึก status เริ่มต้น
    await this.redis.setex(
      statusKey,
      300,
      JSON.stringify({
        jobId: trackingId,
        targetQueueName: queueName,
        status: 'queued',
        clearedCount: 0,
        remainingFailed: null,
      })
    );

    // Enqueue งาน async ผ่าน batchQueue
    await this.batchQueue.add(
      'clear-failed-jobs',
      {
        jobType: 'clear-failed-jobs',
        targetQueueName: queueName,
        trackingId,
        requestedBy: requestedByUserPublicId,
        documentPublicId: trackingId,
        projectPublicId: 'system',
        payload: {
          targetQueueName: queueName,
          requestedBy: requestedByUserPublicId,
        },
        idempotencyKey: trackingId,
      },
      { ...this.defaultOptions, jobId: trackingId }
    );

    return trackingId;
  }

  /**
   * ดึงสถานะของ clear-failed-jobs task จาก Redis
   * @param trackingId tracking ID ที่ได้จาก enqueueClearFailed
   */
  async getClearFailedStatus(
    trackingId: string
  ): Promise<import('./dto/queue-jobs.dto').ClearFailedJobsStatusDto | null> {
    const statusJson = await this.redis.get(
      `ai:clear_failed:job:${trackingId}`
    );
    if (!statusJson) {
      return null;
    }
    return JSON.parse(
      statusJson
    ) as import('./dto/queue-jobs.dto').ClearFailedJobsStatusDto;
  }

  /** Helper: ดึง Queue instance ตามชื่อ (รองรับเฉพาะ ai-batch และ ai-realtime) */
  private getQueueByName(queueName: string): Queue<unknown> {
    if (queueName === 'ai-batch') {
      return this.batchQueue;
    }
    if (queueName === 'ai-realtime') {
      return this.realtimeQueue;
    }
    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Unknown queue: ${queueName}. Allowed: ai-batch, ai-realtime`,
      },
      HttpStatus.BAD_REQUEST
    );
  }

  /**
   * ADR-048 T017 — ดึง failed jobs สำหรับ cleanup (ใช้โดย ai-batch.processor)
   * @param queueName ชื่อ queue ที่ต้องการล้าง failed jobs
   * @param count จำนวนสูงสุดที่จะดึงในรอบนี้
   * @returns array ของ BullMQ Job ที่อยู่ในสถานะ failed
   */
  async getFailedJobsForCleanup(
    queueName: string,
    count: number
  ): Promise<import('bullmq').Job[]> {
    const queue = this.getQueueByName(queueName);
    // BullMQ getFailed(start, end) ใช้ inclusive end index (Redis ZRANGE)
    // ดังนั้น count=1000 ต้องส่ง end=999 เพื่อให้ได้ 1000 jobs
    return queue.getFailed(0, count - 1);
  }

  /**
   * ADR-048 T017 — นับจำนวน failed jobs ที่เหลือใน queue
   * @param queueName ชื่อ queue
   * @returns จำนวน failed jobs
   */
  async countFailedJobs(queueName: string): Promise<number> {
    const queue = this.getQueueByName(queueName);
    const counts = await queue.getJobCounts('failed');
    return counts.failed ?? 0;
  }
}
