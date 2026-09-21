// File: backend/src/common/file-storage/attachment-re-ocr.service.ts
// Change Log
// - 2026-09-19: ADR-055 T020 — Attachment Manual Re-OCR (trigger → status → confirm)
//   Human-in-the-loop: ocr_text ถูกแทนที่เฉพาะตอน confirm เท่านั้น
// - 2026-09-19: review fix — (1) trigger mutex (SET NX) กัน concurrent trigger ที่ผ่าน
//   in-flight guard พร้อมกัน, (2) confirm reject เมื่อ pointer ถูก supersede ด้วย token ใหม่
//   หรือผลใหม่ identical กับ ocr_text เดิม, (3) ตัด documentPublicId ที่ส่ง attachment id ผิด field
// - 2026-09-19: ADR-055 extension (D17–D22) — Production File Replace:
//   triggerReplace (candidate staging/upload → temp attachment) + listLinks (link picker)
//   + confirm branch → junction swap + orphan de-index + audit/queue annotation

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { access, rm } from 'fs/promises';
import { v7 as uuidv7 } from 'uuid';
import { Attachment } from './entities/attachment.entity';
import { CorrespondenceRevisionAttachment } from '../../modules/correspondence/entities/correspondence-revision-attachment.entity';
import { RagAttachmentGeneration } from '../../modules/ai/entities/rag-attachment-generation.entity';
import { MigrationReviewQueue } from '../../modules/migration/entities/migration-review-queue.entity';
import {
  AiAuditLog,
  AiAuditStatus,
} from '../../modules/ai/entities/ai-audit-log.entity';
import type { MigrationFileReplacement } from '../../modules/migration/types/ai-extraction-details.type';
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
import { FileStorageService } from './file-storage.service';
import type { NpDmsOcrJobData } from '../../modules/ai/processors/np-dms-ocr-processor';
import type { SandboxOcrEngineType } from '../../modules/ai/services/sandbox-ocr-engine.service';
import { QUEUE_NP_DMS_OCR } from '../../modules/common/constants/queue.constants';
import {
  BusinessException,
  ConflictException,
  GoneException,
  NotFoundException,
  ValidationException,
} from '../exceptions';

/** ผู้กด trigger (แสดงใน UI "เริ่มโดย …") */
export interface ReOcrActor {
  displayName: string;
}

/** actor ของ replace flow — ต้องใช้ userId เป็น owner ของ temp candidate + audit (D18/D20) */
export interface ReOcrReplaceActor extends ReOcrActor {
  userId: number;
}

/** link ของ attachment ↔ correspondence revision — สำหรับ link picker (D22) */
export interface AttachmentLinkView {
  correspondencePublicId: string;
  correspondenceNumber: string;
  revisionPublicId: string;
  revisionNumber: number;
  isCurrent: boolean;
  isMainDocument: boolean;
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
  | 'reOcrToken'
  | 'triggeredByDisplayName'
  | 'triggeredAt'
  | 'mode'
  | 'targetCorrespondencePublicId'
  | 'candidateAttachmentPublicId'
  | 'candidateFilename'
  | 'candidateSource'
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
    @InjectRepository(CorrespondenceRevisionAttachment)
    private readonly junctionRepo: Repository<CorrespondenceRevisionAttachment>,
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepo: Repository<RagAttachmentGeneration>,
    @InjectRepository(MigrationReviewQueue)
    private readonly reviewQueueRepo: Repository<MigrationReviewQueue>,
    @InjectRepository(AiAuditLog)
    private readonly auditLogRepo: Repository<AiAuditLog>,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue(QUEUE_NP_DMS_OCR)
    private readonly ocrQueue: Queue<NpDmsOcrJobData>,
    private readonly aiQueueService: AiQueueService,
    private readonly ragAdminService: RagAdminService,
    private readonly fileStorageService: FileStorageService
  ) {}

  /** เริ่ม re-OCR — ไม่แก้ attachments.ocr_text (ADR-055 D3) */
  async trigger(
    attachmentPublicId: string,
    engineType: SandboxOcrEngineType,
    actor: ReOcrActor
  ): Promise<ReOcrTriggerResult> {
    const attachment = await this.loadTriggerableAttachment(attachmentPublicId);
    return this.enqueueUnderTriggerLock(attachment, attachment.filePath, {
      engineType,
      actor,
    });
  }

  /**
   * เริ่ม re-OCR แบบ replace — OCR ไฟล์ candidate แล้วให้ admin เทียบก่อน swap junction (D17–D20)
   * - candidate เป็น temp attachment เสมอ (staging → copy เข้า tempDir ก่อน — NAS ปลอดภัย)
   * - link ต้องชี้ไป current revision ของ target correspondence เท่านั้น
   * - checksum เดียวกับไฟล์เดิม → 409 (เปลี่ยนไฟล์เดิมไม่มีประโยชน์)
   */
  async triggerReplace(
    attachmentPublicId: string,
    dto: {
      engineType: SandboxOcrEngineType;
      targetCorrespondencePublicId: string;
      storageTempPath?: string;
      tempAttachmentPublicId?: string;
    },
    actor: ReOcrReplaceActor
  ): Promise<ReOcrTriggerResult> {
    // D20: source XOR — เลือกได้ทางเดียว (ตาม pattern ReplaceQueueFileDto)
    const hasStaging = Boolean(dto.storageTempPath?.trim());
    const hasUpload = Boolean(dto.tempAttachmentPublicId);
    if (hasStaging === hasUpload) {
      throw new ValidationException(
        'Exactly one of storageTempPath or tempAttachmentPublicId is required',
        [
          {
            field: 'storageTempPath / tempAttachmentPublicId',
            message: 'เลือกไฟล์ใหม่ได้ทางเดียว: จาก staging หรืออัปโหลด',
          },
        ]
      );
    }
    const attachment = await this.loadTriggerableAttachment(attachmentPublicId);
    const link = await this.resolveTargetLink(
      attachment,
      dto.targetCorrespondencePublicId
    );
    // แปลง candidate เป็น temp attachment เสมอ — uniform lifecycle (D18)
    let candidate: Attachment;
    let candidateSource: 'STAGING' | 'UPLOAD';
    if (hasUpload) {
      candidateSource = 'UPLOAD';
      const uploaded = await this.attachmentRepo.findOne({
        where: { publicId: dto.tempAttachmentPublicId, isTemporary: true },
      });
      if (!uploaded) {
        throw new NotFoundException(
          'Candidate attachment',
          dto.tempAttachmentPublicId
        );
      }
      if (uploaded.mimeType !== 'application/pdf') {
        throw new BusinessException(
          'RE_OCR_UNSUPPORTED_FILE_TYPE',
          `Candidate must be PDF (got ${uploaded.mimeType})`,
          'ไฟล์ใหม่ต้องเป็น PDF เท่านั้น',
          ['เลือกไฟล์ PDF']
        );
      }
      try {
        await access(uploaded.filePath);
      } catch {
        throw new GoneException(
          'RE_OCR_CANDIDATE_FILE_MISSING',
          `Candidate file missing for attachment ${uploaded.publicId}`,
          'ไฟล์ที่อัปโหลดไว้หมดอายุหรือถูกลบแล้ว กรุณาอัปโหลดใหม่',
          ['อัปโหลดไฟล์อีกครั้ง']
        );
      }
      candidate = uploaded;
    } else {
      candidateSource = 'STAGING';
      // stageFileToTemp: allowed-roots guard + exists + PDF magic bytes + checksum + copy → tempDir
      candidate = await this.fileStorageService.stageFileToTemp(
        dto.storageTempPath as string,
        actor.userId
      );
    }
    // D20: checksum เดียวกับไฟล์เดิม → reject (เปลี่ยนไฟล์เดิมไม่มีประโยชน์ กัน no-op swap)
    if (
      candidate.checksum &&
      attachment.checksum &&
      candidate.checksum === attachment.checksum
    ) {
      if (candidateSource === 'STAGING') {
        // temp copy เพิ่งสร้าง — ลบทิ้งก่อน reject ไม่ให้ค้าง
        await this.discardTempCandidate(candidate);
      }
      throw new ConflictException(
        'RE_OCR_IDENTICAL_FILE',
        `Candidate file is identical to the current file (checksum ${candidate.checksum})`,
        'ไฟล์ใหม่เหมือนกับไฟล์เดิมทุกประการ ไม่จำเป็นต้องเปลี่ยน',
        ['ตรวจสอบว่าเลือกไฟล์ถูกต้อง']
      );
    }
    return this.enqueueUnderTriggerLock(attachment, candidate.filePath, {
      engineType: dto.engineType,
      actor,
      replace: {
        targetCorrespondencePublicId: link.revision!.correspondence!.publicId,
        candidateAttachmentPublicId: candidate.publicId,
        candidateFilename: candidate.originalFilename,
        candidateSource,
      },
    });
  }

  /** link ทั้งหมดของ attachment — สำหรับ link picker เมื่อไฟล์ถูก share หลาย correspondence (D22) */
  async listLinks(attachmentPublicId: string): Promise<AttachmentLinkView[]> {
    const attachment = await this.attachmentRepo.findOne({
      where: { publicId: attachmentPublicId },
      select: ['id', 'publicId'],
    });
    if (!attachment) {
      throw new NotFoundException('Attachment', attachmentPublicId);
    }
    const links = await this.junctionRepo.find({
      where: { attachmentId: attachment.id },
      relations: { revision: { correspondence: true } },
    });
    return links
      .filter((l) => l.revision?.correspondence)
      .map((l) => ({
        correspondencePublicId: l.revision!.correspondence!.publicId,
        correspondenceNumber: l.revision!.correspondence!.correspondenceNumber,
        revisionPublicId: l.revision!.publicId,
        revisionNumber: l.revision!.revisionNumber,
        isCurrent: l.revision!.isCurrent,
        isMainDocument: l.isMainDocument,
      }));
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
      // replace mode (D22): frontend ใช้ fields เหล่านี้แสดง link/candidate ใน dialog
      ...(pointer.mode === 'replace'
        ? {
            mode: 'replace' as const,
            targetCorrespondencePublicId: pointer.targetCorrespondencePublicId,
            candidateAttachmentPublicId: pointer.candidateAttachmentPublicId,
            candidateFilename: pointer.candidateFilename,
            candidateSource: pointer.candidateSource,
          }
        : {}),
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
    // replace mode: currentText = ocr_text ของ attachment เดิม (ยังไม่ถูกแตะ)
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
    reOcrToken: string,
    actor?: ReOcrReplaceActor
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
    // D17: replace mode → junction swap flow (ข้าม identical-text guard — ประเด็นคือไฟล์เปลี่ยน ไม่ใช่ text)
    if (payload.mode === 'replace') {
      return this.confirmReplace(
        attachmentPublicId,
        reOcrToken,
        payload,
        actor
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

  /**
   * Confirm ของ replace mode (D20) — final, ไม่มี rollback:
   *   1) re-verify link ยังเป็น current revision + candidate temp attachment ยังอยู่
   *   2) ตั้ง ocr_text บน candidate ก่อน commit (ingest trigger ของ commit จะเห็น text ใหม่)
   *   3) commit() → ย้ายไฟล์เข้า permanent + auto-ingest (ถ้า candidate commit ไปแล้วจาก retry จะข้าม)
   *   4) tx swap junction: attachment_id เก่า → candidate (is_main_document คงเดิม)
   *   5) ถ้า attachment เก่าไม่มี link เหลือ → retire ACTIVE generations + enqueue cleanup
   *   6) ai_audit_logs + migration queue fileReplacements annotation (best-effort)
   * หมายเหตุ: commit ก่อน swap เสมอ — ถ้า commit พัง junction ยังชี้ไฟล์เดิม (production ไม่เสีย)
   */
  private async confirmReplace(
    attachmentPublicId: string,
    reOcrToken: string,
    payload: ReOcrPayload,
    actor?: ReOcrReplaceActor
  ): Promise<ReOcrConfirmResult> {
    const attachment = await this.attachmentRepo.findOne({
      where: { publicId: attachmentPublicId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment', attachmentPublicId);
    }
    // payload ของ replace ต้องมี context ครบ — ถ้าไม่มีถือว่า payload เสียหาย
    if (
      !payload.targetCorrespondencePublicId ||
      !payload.candidateAttachmentPublicId
    ) {
      throw new NotFoundException('Re-OCR result', attachmentPublicId);
    }
    const link = await this.resolveTargetLink(
      attachment,
      payload.targetCorrespondencePublicId
    );
    const candidate = await this.attachmentRepo.findOne({
      where: { publicId: payload.candidateAttachmentPublicId },
    });
    if (!candidate) {
      throw new NotFoundException(
        'Candidate attachment',
        payload.candidateAttachmentPublicId
      );
    }
    // (2) ตั้งผล OCR บน candidate ก่อน commit — idempotent (retry confirm ทำซ้ำได้)
    await this.attachmentRepo.update(
      { publicId: candidate.publicId },
      {
        ocrText: payload.newText,
        ragStatus: 'PENDING',
        ragLastError: null,
        aiProcessingStatus: 'DONE',
      }
    );
    // (3) commit candidate เข้า permanent (ข้ามถ้า retry หลัง commit ไปแล้ว)
    if (candidate.isTemporary && candidate.tempId) {
      await this.fileStorageService.commit([candidate.tempId], {
        documentType: 'Correspondence',
      });
    }
    // (4) junction swap — แก้เฉพาะ row ของ revision เป้าหมาย (attachment เก่าอยู่ครบสำหรับ link อื่น)
    const swapped = await this.attachmentRepo.manager.transaction(
      async (manager) => {
        const result = await manager.update(
          CorrespondenceRevisionAttachment,
          {
            correspondenceRevisionId: link.correspondenceRevisionId,
            attachmentId: attachment.id,
          },
          { attachmentId: candidate.id }
        );
        return result.affected ?? 0;
      }
    );
    if (swapped === 0) {
      // idempotent retry: junction ชี้ candidate อยู่แล้ว (confirm เดิม crash หลัง swap) → ถือว่าสำเร็จ
      const alreadySwapped = await this.junctionRepo.findOne({
        where: {
          correspondenceRevisionId: link.correspondenceRevisionId,
          attachmentId: candidate.id,
        },
      });
      if (!alreadySwapped) {
        throw new NotFoundException('Attachment link', attachmentPublicId);
      }
    }
    // (5) attachment เก่าไม่มี link เหลือ → de-index (เก็บ row+ไฟล์ไว้ audit); ยังถูก share → ไม่แตะ
    let reindexQueued = true;
    try {
      await this.deindexIfOrphaned(attachment, link);
    } catch (err) {
      reindexQueued = false;
      this.logger.error(
        `Re-OCR replace: orphan de-index ล้มเหลว — attachment=${attachmentPublicId}`,
        err instanceof Error ? err.stack : String(err)
      );
    }
    // (6) audit + queue annotation — best-effort ไม่ให้กระทบผล confirm
    await this.writeReplaceAudit(link, attachment, candidate, payload, actor);
    await this.annotateMigrationQueue(
      link,
      attachment,
      candidate,
      payload,
      reOcrToken,
      actor
    );
    await this.cleanupKeys(attachmentPublicId, reOcrToken);
    return { status: 'confirmed', ragStatus: 'PENDING', reindexQueued };
  }

  /** โหลด attachment + guard D9.1/D12 (PDF, ไฟล์อยู่จริง, ไม่ PROCESSING) — shared ระหว่าง trigger/triggerReplace */
  private async loadTriggerableAttachment(
    attachmentPublicId: string
  ): Promise<Attachment> {
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
    return attachment;
  }

  /**
   * หา junction row ที่ชี้ attachment → current revision ของ target correspondence (D17/D20)
   * @throws 404 RE_OCR_LINK_NOT_FOUND — attachment ไม่ได้ผูกกับ correspondence นี้
   * @throws 409 RE_OCR_LINK_NOT_CURRENT — link อยู่บน historical revision (เปลี่ยนได้เฉพาะ current)
   */
  private async resolveTargetLink(
    attachment: Attachment,
    targetCorrespondencePublicId: string
  ): Promise<CorrespondenceRevisionAttachment> {
    const links = await this.junctionRepo.find({
      where: { attachmentId: attachment.id },
      relations: { revision: { correspondence: { project: true } } },
    });
    const link = links.find(
      (l) =>
        l.revision?.correspondence?.publicId === targetCorrespondencePublicId
    );
    if (!link || !link.revision) {
      throw new NotFoundException(
        'Attachment link',
        `${attachment.publicId} → ${targetCorrespondencePublicId}`
      );
    }
    if (!link.revision.isCurrent) {
      throw new ConflictException(
        'RE_OCR_LINK_NOT_CURRENT',
        `Attachment ${attachment.publicId} is linked to a historical revision of ${targetCorrespondencePublicId}`,
        'เปลี่ยนไฟล์ได้เฉพาะ revision ปัจจุบันของเอกสารเท่านั้น',
        ['เลือก correspondence ที่ revision ปัจจุบันใช้ไฟล์นี้']
      );
    }
    return link;
  }

  /**
   * Trigger mutex (SET NX) → in-flight guard → เขียน pointer → enqueue — shared trigger/triggerReplace
   * @param replace fields เพิ่มเติมของ replace mode (เขียนลง pointer + job data → payload)
   */
  private async enqueueUnderTriggerLock(
    attachment: Attachment,
    pdfPath: string,
    opts: {
      engineType: SandboxOcrEngineType;
      actor: ReOcrActor;
      replace?: {
        targetCorrespondencePublicId: string;
        candidateAttachmentPublicId: string;
        candidateFilename: string;
        candidateSource: 'STAGING' | 'UPLOAD';
      };
    }
  ): Promise<ReOcrTriggerResult> {
    const attachmentPublicId = attachment.publicId;
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
        engineType: opts.engineType,
        triggeredByDisplayName: opts.actor.displayName,
        triggeredAt,
        updatedAt: triggeredAt,
        ...(opts.replace
          ? {
              mode: 'replace' as const,
              targetCorrespondencePublicId:
                opts.replace.targetCorrespondencePublicId,
              candidateAttachmentPublicId:
                opts.replace.candidateAttachmentPublicId,
              candidateFilename: opts.replace.candidateFilename,
              candidateSource: opts.replace.candidateSource,
            }
          : {}),
      };
      await this.redis.setex(
        reOcrPointerKey(attachmentPublicId),
        RE_OCR_TTL_SECONDS,
        JSON.stringify(pointer)
      );
      try {
        // ไม่ส่ง documentPublicId — job นี้ระบุตัวด้วย attachmentPublicId (audit field เดิมเป็น document-level)
        const queued = await this.aiQueueService.enqueueAttachmentReOcr({
          pdfPath,
          engineType: opts.engineType,
          idempotencyKey: reOcrToken,
          attachmentPublicId,
          reOcrToken,
          forceRefresh: true,
          triggeredByDisplayName: opts.actor.displayName,
          triggeredAt,
          // replace mode: processor copy fields เหล่านี้ลง payload ตอน completed
          ...(opts.replace
            ? {
                mode: 'replace' as const,
                targetCorrespondencePublicId:
                  opts.replace.targetCorrespondencePublicId,
                candidateAttachmentPublicId:
                  opts.replace.candidateAttachmentPublicId,
                candidateFilename: opts.replace.candidateFilename,
                candidateSource: opts.replace.candidateSource,
              }
            : {}),
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

  /** ลบ temp candidate ที่เพิ่ง stage (กรณี reject หลังสร้าง เช่น checksum ซ้ำ) — best-effort */
  private async discardTempCandidate(candidate: Attachment): Promise<void> {
    try {
      await rm(candidate.filePath, { force: true });
      await this.attachmentRepo.delete({ id: candidate.id });
    } catch (err) {
      this.logger.warn(
        `discardTempCandidate ล้มเหลว (cleanup worker จะเก็บต่อเมื่อหมดอายุ): ${candidate.publicId} — ${String(err)}`
      );
    }
  }

  /**
   * attachment เก่าไม่มี link เหลือ → retire ACTIVE generations แล้ว enqueue cleanup (D20)
   * ใช้ generation lifecycle เดิม (chunk-scoped delete) — ไม่ลบแบบ doc-level เพราะอาจชน attachment อื่น
   */
  private async deindexIfOrphaned(
    attachment: Attachment,
    link: CorrespondenceRevisionAttachment
  ): Promise<void> {
    const remaining = await this.junctionRepo.count({
      where: { attachmentId: attachment.id },
    });
    if (remaining > 0) {
      return; // ยังถูก share — ไฟล์เดิมต้อง index ต่อสำหรับ correspondence อื่น
    }
    const generations = await this.generationRepo.find({
      where: { attachmentUuid: attachment.publicId, status: 'ACTIVE' },
    });
    if (generations.length === 0) {
      return;
    }
    const projectPublicId = link.revision?.correspondence?.project?.publicId;
    if (!projectPublicId) {
      // cleanup job ต้องการ projectPublicId สำหรับ Qdrant scope — ไม่มี = enqueue ไม่ได้
      // ปล่อย generations เป็น ACTIVE ไว้ให้ Vector Health Check (ADR-056) จัดการต่อ
      this.logger.warn(
        `Re-OCR replace: ไม่พบ projectPublicId ของ orphan attachment ${attachment.publicId} — ข้าม de-index`
      );
      return;
    }
    for (const gen of generations) {
      await this.generationRepo.update(
        { generationUuid: gen.generationUuid },
        { status: 'RETIRED', retiredAt: new Date() }
      );
      await this.aiQueueService.enqueueRagGenerationCleanup({
        generationUuid: gen.generationUuid,
        attachmentPublicId: attachment.publicId,
        projectPublicId,
      });
    }
    this.logger.log(
      `Re-OCR replace: retired ${generations.length} generation(s) of orphaned attachment ${attachment.publicId}`
    );
  }

  /** ai_audit_logs ของการ replace — บันทึก old/new attachment + link + source (D20) */
  private async writeReplaceAudit(
    link: CorrespondenceRevisionAttachment,
    oldAttachment: Attachment,
    candidate: Attachment,
    payload: ReOcrPayload,
    actor?: ReOcrReplaceActor
  ): Promise<void> {
    try {
      const correspondence = link.revision!.correspondence!;
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          documentPublicId: correspondence.publicId,
          aiModel: 'np-dms-ocr',
          modelName: payload.engineUsed,
          modelType: 'attachment-re-ocr:replace',
          status: AiAuditStatus.SUCCESS,
          processingTimeMs: payload.processingTimeMs,
          confirmedByUserId: actor?.userId,
          humanOverrideJson: {
            action: 'attachment-file-replace',
            oldAttachmentPublicId: oldAttachment.publicId,
            newAttachmentPublicId: candidate.publicId,
            oldFilename: oldAttachment.originalFilename,
            newFilename: candidate.originalFilename,
            correspondencePublicId: correspondence.publicId,
            correspondenceNumber: correspondence.correspondenceNumber,
            revisionPublicId: link.revision!.publicId,
            candidateSource: payload.candidateSource,
          },
        })
      );
    } catch (err) {
      this.logger.error(
        `Re-OCR replace: เขียน ai_audit_logs ล้มเหลว — attachment=${oldAttachment.publicId}`,
        err instanceof Error ? err.stack : String(err)
      );
    }
  }

  /**
   * Annotate migration queue row ที่ import มาเป็น correspondence นี้ (D20)
   * append review_state_json.fileReplacements — best-effort, ไม่พบ row ก็ข้ามเงียบ ๆ
   */
  private async annotateMigrationQueue(
    link: CorrespondenceRevisionAttachment,
    oldAttachment: Attachment,
    candidate: Attachment,
    payload: ReOcrPayload,
    reOcrToken: string,
    actor?: ReOcrReplaceActor
  ): Promise<void> {
    try {
      const correspondence = link.revision!.correspondence!;
      const queueItem = await this.reviewQueueRepo.findOne({
        where: { importedCorrespondencePublicId: correspondence.publicId },
      });
      if (!queueItem) {
        return;
      }
      const entry: MigrationFileReplacement = {
        idempotencyKey: reOcrToken,
        at: new Date().toISOString(),
        userId: actor?.userId ?? 0,
        source: payload.candidateSource ?? 'UPLOAD',
        previousPath: oldAttachment.filePath,
        newPath: candidate.filePath,
        filename: candidate.originalFilename,
        attachmentPublicId: candidate.publicId,
      };
      queueItem.reviewState = {
        ...(queueItem.reviewState ?? {}),
        fileReplacements: [
          ...(queueItem.reviewState?.fileReplacements ?? []),
          entry,
        ],
      };
      await this.reviewQueueRepo.save(queueItem);
    } catch (err) {
      this.logger.error(
        `Re-OCR replace: annotate migration queue ล้มเหลว — attachment=${oldAttachment.publicId}`,
        err instanceof Error ? err.stack : String(err)
      );
    }
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
