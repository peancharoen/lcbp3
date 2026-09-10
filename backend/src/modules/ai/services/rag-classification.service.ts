// File: backend/src/modules/ai/services/rag-classification.service.ts
// Change Log:
// - 2026-09-14: T068+T069+T070 — เพิ่ม classification inheritance/override service (Feature 254, Phase 7 US5)
//   ตรวจสิทธิ์ document.classification_override ผ่าน CASL, บันทึก audit trail,
//   และ enqueue Qdrant metadata sync แบบ asynchronous (ADR-016, ADR-008, ADR-023)

import {
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbilityFactory } from '../../../common/auth/casl/ability.factory';
import type {
  Actions,
  Subjects,
} from '../../../common/auth/casl/ability.factory';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { AuditLog } from '../../../common/entities/audit-log.entity';
import { User } from '../../user/entities/user.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { AiQueueService } from '../ai-queue.service';

/** Classification levels ที่รองรับในระบบ (ADR-016) */
export type ClassificationLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

/** Audit action สำหรับ classification override */
const AUDIT_ACTION = 'rag.attachment.classification_override';

/** Entity type สำหรับ audit log */
const AUDIT_ENTITY_TYPE = 'rag_attachment';

/**
 * พารามิเตอร์สำหรับ overrideClassification
 */
export interface OverrideClassificationParams {
  /** UUIDv7 publicId ของ Attachment */
  attachmentPublicId: string;
  /** Classification ใหม่ที่ต้องการตั้ง */
  newClassification: ClassificationLevel;
  /** เหตุผลในการเปลี่ยน classification (บันทึกใน audit trail) */
  reason: string;
  /** ผู้ที่ทำการเปลี่ยน (จาก JWT payload) */
  user: User;
}

/**
 * ผลลัพธ์การดึง effective classification
 */
export interface EffectiveClassificationResult {
  /** UUIDv7 publicId ของ Attachment */
  attachmentPublicId: string;
  /** Classification ที่มีผลอยู่ในปัจจุบัน */
  classification: ClassificationLevel;
  /** แหล่งที่มาของ classification (override หรือ inherited) */
  source: 'override' | 'inherited';
}

/**
 * บริการจัดการ classification ของ Attachment ตาม ADR-016
 * รองรับ CASL permission check, audit trail, และ Qdrant metadata sync แบบ asynchronous
 */
@Injectable()
export class RagClassificationService {
  private readonly logger = new Logger(RagClassificationService.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly abilityFactory: AbilityFactory,
    @Optional()
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository?: Repository<RagAttachmentGeneration>,
    @Optional()
    private readonly aiQueueService?: AiQueueService
  ) {}

  /**
   * เปลี่ยน classification ของ Attachment โดยตรวจสิทธิ์ CASL ก่อนเสมอ
   * บันทึก audit trail (before/after/reason/actor) และ enqueue Qdrant metadata sync
   * @param params พารามิเตอร์การ override
   * @throws ForbiddenException เมื่อผู้ใช้ไม่มีสิทธิ์ document.classification_override หรือ system.manage_all
   */
  public async overrideClassification(
    params: OverrideClassificationParams
  ): Promise<void> {
    const { attachmentPublicId, newClassification, reason, user } = params;

    // 1. ตรวจสิทธิ์ CASL — document.classification_override หรือ system.manage_all (Superadmin)
    const ability = this.abilityFactory.createForUser(user, {});
    const hasOverride = ability.can(
      'classification_override' as Actions,
      'document' as Subjects
    );
    const isSuperadmin = ability.can('manage' as Actions, 'all' as Subjects);
    if (!hasOverride && !isSuperadmin) {
      throw new ForbiddenException(
        'You do not have permission to override document classification'
      );
    }

    // 2. ดึง Attachment เพื่อบันทึกค่า classification เดิม (before)
    const attachment = await this.attachmentRepository.findOne({
      where: { publicId: attachmentPublicId },
    });
    if (!attachment) {
      throw new ForbiddenException(
        `Attachment not found: ${attachmentPublicId}`
      );
    }

    const beforeClassification = attachment.classification;

    // 3. อัปเดต classification ใน DB
    await this.attachmentRepository.update(
      { publicId: attachmentPublicId },
      { classification: newClassification }
    );

    // 4. บันทึก audit trail (before/after/reason/actor)
    const auditEntry = this.auditLogRepository.create({
      userId: user.user_id,
      action: AUDIT_ACTION,
      entityType: AUDIT_ENTITY_TYPE,
      entityId: attachmentPublicId,
      severity: 'INFO',
      detailsJson: {
        beforeClassification,
        afterClassification: newClassification,
        reason,
        actorUserPublicId: user.publicId,
      },
    });
    await this.auditLogRepository.save(auditEntry);

    // 5. Enqueue Qdrant metadata sync แบบ asynchronous (ADR-008)
    await this.enqueueMetadataSync(attachmentPublicId);

    this.logger.log(
      `Classification override — attachment=${attachmentPublicId}, ` +
        `${beforeClassification}→${newClassification}, actor=${user.publicId}`
    );
  }

  /**
   * ดึง effective classification ของ Attachment
   * ถ้าไม่มี override จะ inherit จาก parent (document/project) ในอนาคต
   * @param attachmentPublicId UUIDv7 ของ Attachment
   * @returns effective classification พร้อมแหล่งที่มา
   */
  public async getEffectiveClassification(
    attachmentPublicId: string
  ): Promise<EffectiveClassificationResult> {
    const attachment = await this.attachmentRepository.findOne({
      where: { publicId: attachmentPublicId },
    });
    if (!attachment) {
      throw new ForbiddenException(
        `Attachment not found: ${attachmentPublicId}`
      );
    }

    // ปัจจุบัน classification เก็บที่ Attachment โดยตรง
    // ในอนาคตอาจมี inheritance จาก parent document/project (TBD)
    return {
      attachmentPublicId,
      classification: attachment.classification,
      source: 'override',
    };
  }

  /**
   * Enqueue Qdrant metadata sync job สำหรับอัปเดต classification ใน Qdrant payload
   * ใช้ BullMQ ai-batch queue ตาม ADR-008 (ไม่ block request thread)
   * @param attachmentPublicId UUIDv7 ของ Attachment
   */
  private async enqueueMetadataSync(attachmentPublicId: string): Promise<void> {
    if (!this.aiQueueService || !this.generationRepository) {
      // ไม่มี queue service (unit test) — skip async sync
      return;
    }

    try {
      const activeGeneration = await this.generationRepository.findOne({
        where: { attachmentUuid: attachmentPublicId, status: 'ACTIVE' },
      });
      if (!activeGeneration) {
        this.logger.warn(
          `No ACTIVE generation for ${attachmentPublicId} — skipping Qdrant metadata sync`
        );
        return;
      }

      await this.aiQueueService.enqueueRagMetadataSync({
        generationUuid: activeGeneration.generationUuid,
        attachmentPublicId,
      });
    } catch (err: unknown) {
      // ไม่ throw — Qdrant sync เป็น best-effort (eventual consistency)
      this.logger.error(
        `Failed to enqueue Qdrant metadata sync for ${attachmentPublicId}: ` +
          `${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
