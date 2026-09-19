// File: backend/src/common/file-storage/attachment-re-ocr.service.ts
// Change Log
// - 2026-09-19: ADR-055 T020 — Attachment Manual Re-OCR (trigger → status → confirm)
//   Human-in-the-loop: ocr_text ถูกแทนที่เฉพาะตอน confirm เท่านั้น
// - 2026-09-19: review fix — (1) trigger mutex (SET NX) กัน concurrent trigger ที่ผ่าน
//   in-flight guard พร้อมกัน, (2) confirm reject เมื่อ pointer ถูก supersede ด้วย token ใหม่
//   หรือผลใหม่ identical กับ ocr_text เดิม, (3) ตัด documentPublicId ที่ส่ง attachment id ผิด field

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { access } from 'fs/promises';
import { v7 as uuidv7 } from 'uuid';
import { Attachment } from './entities/attachment.entity';
import {
  RE_OCR_TTL_SECONDS,
  RE_OCR_TRIGGER_LOCK_TTL_SECONDS,
  ReOcrPayload,
  ReOcrPointer,
  reOcrPayloadKey,
  reOcrPointerKey,
  reOcrTriggerLockKey,
} from './re-ocr.constants';
import {
  AiQueueService,
  buildReOcrJobId,
} from '../../modules/ai/ai-queue.service';
import { RagAdminService } from '../../modules/ai/services/rag-admin.service';
import type { NpDmsOcrJobData } from '../../modules/ai/processors/np-dms-ocr-processor';
import type { SandboxOcrEngineType } from '../../modules/ai/services/sandbox-ocr-engine.service';
import { QUEUE_NP_DMS_OCR } from '../../modules/common/constants/queue.constants';
import {
  BusinessException,
  ConflictException,
  GoneException,
  NotFoundException,
} from '../exceptions';

/** ผู้กด trigger (แสดงใน UI "เริ่มโดย …") */
export interface ReOcrActor {
  displayName: string;
}

/** Response ของ POST re-ocr (trigger) */
export interface ReOcrTriggerResult {
  reOcrToken: string;
  jobId: string;
  status: 'queued';
  queuePosition: number;
  estimatedWaitSeconds: number;
}

/** Response ของ GET re-ocr/status */
export type ReOcrStatusResult = Pick<
  ReOcrPointer,
  'reOcrToken' | 'triggeredByDisplayName' | 'triggeredAt'
> &
  (
    | {
        status: 'queued' | 'processing';
        jobId: string;
        engineType: string;
        attempt?: number;
      }
    | { status: 'failed'; errorMessage: string }
    | ({
        status: 'completed';
        identical: boolean;
        /** ocr_text ปัจจุบัน (ซ้ายของ side-by-side diff) — '' ถ้ายังไม่มี */
        currentText: string;
        warning?: 'RESULT_MUCH_SHORTER';
      } & ReOcrPayload)
  );

/** Response ของ POST re-ocr/confirm */
export interface ReOcrConfirmResult {
  status: 'confirmed';
  ragStatus: 'PENDING';
  /** false = แทนที่ text สำเร็จแต่ enqueue re-index ไม่สำเร็จ (health check ADR-056 จะซ่อม) */
  reindexQueued: boolean;
}

/** สั้นกว่าเดิมต่ำกว่าอัตรานี้ → แสดง warning (ยังยืนยันได้) — ADR-055 D16 */
const SHRINK_WARNING_RATIO = 0.5;
/** state ของ BullMQ job ที่ยังถือว่า "อยู่ในคิว/กำลังรัน" (in-flight guard — ADR-055 D9) */
const LIVE_JOB_STATES = new Set([
  'waiting',
  'active',
  'delayed',
  'prioritized',
  'waiting-children',
]);

/**
 * Service ของ Attachment Manual Re-OCR (ADR-055)
 * - trigger: guard → เขียน status pointer → enqueue เข้า QUEUE_NP_DMS_OCR (ไม่แตะ ocr_text)
 * - getStatus: อ่าน pointer (+ payload เมื่อ completed) พร้อม identical/warning
 * - confirm: transaction อัปเดต attachment → commit → reingest(force) → ลบ Redis keys
 */
@Injectable()
export class AttachmentReOcrService {
  private readonly logger = new Logger(AttachmentReOcrService.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue(QUEUE_NP_DMS_OCR)
    private readonly ocrQueue: Queue<NpDmsOcrJobData>,
    private readonly aiQueueService: AiQueueService,
    private readonly ragAdminService: RagAdminService
  ) {}

  /** เริ่ม re-OCR — ไม่แก้ attachments.ocr_text (ADR-055 D3) */
  async trigger(
    attachmentPublicId: string,
    engineType: SandboxOcrEngineType,
    actor: ReOcrActor
  ): Promise<ReOcrTriggerResult> {
    const attachment = await this.attachmentRepo.findOne({
      where: { publicId: attachmentPublicId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment', attachmentPublicId);
    }
    // D12: PDF-only + ไฟล์ต้องอยู่จริง (fail fast ก่อนเสีย queue slot/GPU)
    if (attachment.mimeType !== 'application/pdf') {
      throw new BusinessException(
        'RE_OCR_UNSUPPORTED_FILE_TYPE',
        `Re-OCR supports PDF only (got ${attachment.mimeType})`,
        'รองรับ Re-OCR เฉพาะไฟล์ PDF เท่านั้น',
        ['เลือกไฟล์แนบที่เป็น PDF']
      );
    }
    try {
      await access(attachment.filePath);
    } catch {
      throw new GoneException(
        'RE_OCR_SOURCE_FILE_MISSING',
        `Source file missing for attachment ${attachmentPublicId}`,
        'ไม่พบไฟล์ต้นฉบับใน storage',
        ['ติดต่อผู้ดูแลระบบเพื่อตรวจสอบ storage']
      );
    }
    // D9.1: มี ingestion job กำลังรันอยู่ห้าม trigger ซ้อน (PENDING/DONE/FAILED อนุญาต)
    if (attachment.aiProcessingStatus === 'PROCESSING') {
      throw new ConflictException(
        'RE_OCR_INGESTION_IN_PROGRESS',
        `Attachment ${attachmentPublicId} is being processed`,
        'ไฟล์นี้กำลังถูกประมวลผลอยู่ กรุณารอให้เสร็จก่อน',
        ['รอให้การประมวลผลปัจจุบันเสร็จแล้วลองใหม่']
      );
    }
    // Trigger mutex (SET NX) — serialize ช่วง check-pointer + write-pointer + enqueue
    // กัน 2 request ที่อ่าน pointer พร้อมกันแล้วผ่าน in-flight guard ทั้งคู่ (TOCTOU)
    const reOcrToken = uuidv7();
    const lockKey = reOcrTriggerLockKey(attachmentPublicId);
    const locked = await this.redis.set(
      lockKey,
      reOcrToken,
      'EX',
      RE_OCR_TRIGGER_LOCK_TTL_SECONDS,
      'NX'
    );
    if (locked !== 'OK') {
      throw new ConflictException(
        'RE_OCR_ALREADY_IN_PROGRESS',
        `Another re-OCR trigger is in progress for ${attachmentPublicId}`,
        'มีการเริ่ม Re-OCR ของไฟล์นี้อยู่แล้ว',
        ['รอสักครู่แล้วลองใหม่']
      );
    }
    try {
      // D9.2: in-flight guard — pointer queued/processing และ job ยังอยู่ใน BullMQ จริง
      const previousRaw = await this.redis.get(
        reOcrPointerKey(attachmentPublicId)
      );
      await this.assertNoLiveJob(previousRaw);

      const triggeredAt = new Date().toISOString();
      // jobId deterministic — เขียนลง pointer ก่อน enqueue เพื่อให้ guard ของ trigger ถัดไป verify ได้
      const pointer: ReOcrPointer = {
        status: 'queued',
        reOcrToken,
        jobId: buildReOcrJobId(attachmentPublicId, reOcrToken),
        engineType,
        triggeredByDisplayName: actor.displayName,
        triggeredAt,
        updatedAt: triggeredAt,
      };
      await this.redis.setex(
        reOcrPointerKey(attachmentPublicId),
        RE_OCR_TTL_SECONDS,
        JSON.stringify(pointer)
      );
      try {
        // ไม่ส่ง documentPublicId — job นี้ระบุตัวด้วย attachmentPublicId (audit field เดิมเป็น document-level)
        const queued = await this.aiQueueService.enqueueAttachmentReOcr({
          pdfPath: attachment.filePath,
          engineType,
          idempotencyKey: reOcrToken,
          attachmentPublicId,
          reOcrToken,
          forceRefresh: true,
          triggeredByDisplayName: actor.displayName,
          triggeredAt,
        });
        return {
          reOcrToken,
          jobId: queued.jobId,
          status: 'queued',
          queuePosition: queued.queuePosition,
          estimatedWaitSeconds: queued.estimatedWaitSeconds,
        };
      } catch (err) {
        // enqueue ล้มเหลว (เช่น 503 AI unavailable) → คืน pointer เดิม ไม่ทิ้ง 'queued' ค้าง
        await this.restorePointer(attachmentPublicId, previousRaw);
        throw err;
      }
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /** อ่านสถานะ/ผลลัพธ์ — newText ส่งเฉพาะตอน completed (ADR-055 D14) */
  async getStatus(attachmentPublicId: string): Promise<ReOcrStatusResult> {
    const pointer = await this.readPointer(attachmentPublicId);
    if (!pointer) {
      throw new NotFoundException('Re-OCR job', attachmentPublicId);
    }
    const base = {
      reOcrToken: pointer.reOcrToken,
      triggeredByDisplayName: pointer.triggeredByDisplayName,
      triggeredAt: pointer.triggeredAt,
    };
    if (pointer.status === 'failed') {
      return {
        ...base,
        status: 'failed',
        errorMessage: pointer.errorMessage ?? 'Unknown error',
      };
    }
    if (pointer.status !== 'completed') {
      return {
        ...base,
        status: pointer.status,
        jobId: pointer.jobId,
        engineType: pointer.engineType,
        ...(pointer.attempt !== undefined ? { attempt: pointer.attempt } : {}),
      };
    }
    const payload = await this.readPayload(
      attachmentPublicId,
      pointer.reOcrToken
    );
    if (!payload) {
      throw new NotFoundException('Re-OCR result', attachmentPublicId);
    }
    const attachment = await this.attachmentRepo.findOne({
      where: { publicId: attachmentPublicId },
      select: ['publicId', 'ocrText'],
    });
    const current = attachment?.ocrText ?? '';
    const shrunk =
      current.length > 0 &&
      payload.newText.length < current.length * SHRINK_WARNING_RATIO;
    return {
      ...base,
      status: 'completed',
      ...payload,
      identical: payload.newText === current,
      currentText: current,
      ...(shrunk ? { warning: 'RESULT_MUCH_SHORTER' as const } : {}),
    };
  }

  /** ยืนยันแทนที่ ocr_text — final decision ไม่มี rollback (ADR-055 D8) */
  async confirm(
    attachmentPublicId: string,
    reOcrToken: string
  ): Promise<ReOcrConfirmResult> {
    const payload = await this.readPayload(attachmentPublicId, reOcrToken);
    if (!payload) {
      throw new NotFoundException('Re-OCR result', attachmentPublicId);
    }
    // ถ้า pointer ถูก supersede ด้วย trigger ใหม่กว่า → reject (กัน stale confirm มาแทนที่กลาง job ใหม่)
    const pointer = await this.readPointer(attachmentPublicId);
    if (pointer && pointer.reOcrToken !== reOcrToken) {
      throw new ConflictException(
        'RE_OCR_SUPERSEDED',
        `Re-OCR result ${reOcrToken} was superseded by a newer trigger`,
        'ผลลัพธ์นี้ถูกแทนด้วย Re-OCR รอบใหม่แล้ว',
        ['เปิด Re-OCR อีกครั้งเพื่อดูผลล่าสุด']
      );
    }
    // Server-side identical guard — ผลใหม่เท่าเดิมเป๊ะไม่มีประโยชน์ในการแทนที่ (กัน re-index churn)
    const attachment = await this.attachmentRepo.findOne({
      where: { publicId: attachmentPublicId },
      select: ['publicId', 'ocrText'],
    });
    if (!attachment) {
      throw new NotFoundException('Attachment', attachmentPublicId);
    }
    if (payload.newText === (attachment.ocrText ?? '')) {
      throw new ConflictException(
        'RE_OCR_IDENTICAL',
        `Re-OCR result ${reOcrToken} is identical to the current OCR text`,
        'ผลลัพธ์ใหม่เหมือนกับข้อความเดิมทุกตัวอักษร ไม่จำเป็นต้องแทนที่',
        ['ปิดหน้าต่างนี้ได้โดยไม่ต้องยืนยัน']
      );
    }
    // D6: transaction เดียว — commit ก่อน enqueue เสมอ
    const affected = await this.attachmentRepo.manager.transaction(
      async (manager) => {
        const result = await manager.update(
          Attachment,
          { publicId: attachmentPublicId },
          {
            ocrText: payload.newText,
            ragStatus: 'PENDING',
            ragLastError: null,
            aiProcessingStatus: 'DONE',
          }
        );
        return result.affected ?? 0;
      }
    );
    if (affected === 0) {
      throw new NotFoundException('Attachment', attachmentPublicId);
    }
    let reindexQueued = true;
    try {
      await this.ragAdminService.reingest(attachmentPublicId);
    } catch (err) {
      // text ถูกแทนที่แล้ว (rag_status=PENDING) — Vector Health Check (ADR-056) ซ่อมต่อ
      reindexQueued = false;
      this.logger.error(
        `Re-OCR confirm: reingest ล้มเหลวหลัง commit — attachment=${attachmentPublicId}`,
        err instanceof Error ? err.stack : String(err)
      );
    }
    await this.cleanupKeys(attachmentPublicId, reOcrToken);
    return { status: 'confirmed', ragStatus: 'PENDING', reindexQueued };
  }

  /** D9.2: 409 ถ้า pointer queued/processing และ job ยังอยู่ในคิว; pointer stale → ผ่าน */
  private async assertNoLiveJob(rawPointer: string | null): Promise<void> {
    const pointer = this.parsePointer(rawPointer);
    if (
      !pointer ||
      (pointer.status !== 'queued' && pointer.status !== 'processing') ||
      !pointer.jobId
    ) {
      return;
    }
    const job = await this.ocrQueue.getJob(pointer.jobId);
    const state = job ? await job.getState() : undefined;
    if (state && LIVE_JOB_STATES.has(state)) {
      throw new ConflictException(
        'RE_OCR_ALREADY_IN_PROGRESS',
        `Re-OCR job ${pointer.jobId} is already ${state}`,
        'มี Re-OCR ของไฟล์นี้กำลังทำงานอยู่แล้ว',
        [
          `เริ่มโดย ${pointer.triggeredByDisplayName}`,
          'รอให้งานเดิมเสร็จ หรือเปิดดูผลลัพธ์งานเดิม',
        ]
      );
    }
  }

  private async restorePointer(
    attachmentPublicId: string,
    previousRaw: string | null
  ): Promise<void> {
    if (previousRaw) {
      await this.redis.setex(
        reOcrPointerKey(attachmentPublicId),
        RE_OCR_TTL_SECONDS,
        previousRaw
      );
    } else {
      await this.redis.del(reOcrPointerKey(attachmentPublicId));
    }
  }

  /** ลบ payload เสมอ และลบ pointer เฉพาะเมื่อเป็นของ token นี้ (ไม่ทำลาย job ใหม่กว่า) */
  private async cleanupKeys(
    attachmentPublicId: string,
    reOcrToken: string
  ): Promise<void> {
    const pointer = await this.readPointer(attachmentPublicId);
    const keys = [reOcrPayloadKey(attachmentPublicId, reOcrToken)];
    if (!pointer || pointer.reOcrToken === reOcrToken) {
      keys.push(reOcrPointerKey(attachmentPublicId));
    }
    await this.redis.del(...keys);
  }

  private async readPointer(
    attachmentPublicId: string
  ): Promise<ReOcrPointer | null> {
    return this.parsePointer(
      await this.redis.get(reOcrPointerKey(attachmentPublicId))
    );
  }

  private parsePointer(raw: string | null): ReOcrPointer | null {
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as ReOcrPointer;
    } catch {
      this.logger.warn('Re-OCR pointer เสียหาย — ถือว่าไม่มี');
      return null;
    }
  }

  private async readPayload(
    attachmentPublicId: string,
    reOcrToken: string
  ): Promise<ReOcrPayload | null> {
    const raw = await this.redis.get(
      reOcrPayloadKey(attachmentPublicId, reOcrToken)
    );
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as ReOcrPayload;
    } catch {
      this.logger.warn('Re-OCR payload เสียหาย — ถือว่าไม่มี');
      return null;
    }
  }
}
