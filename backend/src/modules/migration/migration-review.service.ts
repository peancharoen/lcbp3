// File: src/modules/migration/migration-review.service.ts
// Change Log:
// - 2026-05-22: Initial creation for US2 - Migration Review Queue Commit (T020a)
// - 2026-05-22: Integrated UuidResolverService to resolve hybrid identifiers (T020a)
// - 2026-08-17: ADR-016/002/007 compliance — รับ idempotencyKey จริง, ลบ hardcoded
// - 2026-08-23: Execute Import บันทึก ocrText ลง Attachment.ocr_text และ Revision.body
//   fallback `|| 1` / `|| 3`, ใช้ BusinessException สำหรับ missing master data,
//   ใช้ SELECT FOR UPDATE ป้องกัน revision race condition (Issue #3)
// - 2026-08-26: Bugfix — แก้ชื่อคอลัมน์ junction table ผิด ("revision_id" →
//   "correspondence_revision_id") และเปลี่ยนไปใช้ shared utility
//   linkAttachmentsToRevision เพื่อป้องกัน column name drift กับ importCorrespondence
// - 2026-08-26: Bugfix — ย้ายไฟล์จาก tempDir ไป permanent/{docType}/{YYYY}/{MM}/
//   โดยใช้วันที่เอกสาร (issuedDate) ก่อนนี้ไฟล์ติดอยู่ใน tempDir ตลอดเพราะ commitRecord
//   ไม่ได้เรียก commit() ทำให้ folder structure ไม่ถูกต้อง
// - 2026-08-31: ADR-050 (FOUND-COMMIT unit — T014 remainder, T016, T017, T018):
//   - T014: block commit บน legacy-shaped item (มิเรอร์ MigrationService.isLegacyExtractionShape())
//   - T016: per-field commit gate — block commit เมื่อมี field confidence ต่ำกว่า threshold
//     ที่ยังไม่ resolved (แก้ไข/รับทราบ) — throw UnresolvedFieldsException (ใหม่ ขยายจาก
//     BaseException) พร้อม `unresolvedFields[]`
//   - T017: validate dto.category กับ MigrationService.getAllowedCategoryCodes()
//     (correspondence_types.typeCode) — reject ด้วย BusinessException ถ้าไม่พบ
//   - T018: เปลี่ยนจาก `dto.tags: string[]` (ลบแล้ว) เป็น `dto.tagDecisions[]` — ผูกเฉพาะ
//     tag ที่ accepted=true เข้าเอกสาร, บันทึก ai_audit_logs (aiSuggestionJson/humanOverrideJson/
//     confirmedByUserId) สำหรับทุก tag ที่ reject (ai_audit_logs ไม่มีคอลัมน์ action/payload_json/
//     queue_item_public_id/actor_user_id ตาม data-model.md §5 จริง — map ไปยัง column ที่มีอยู่แล้ว
//     แทน ดู JUDGMENT CALLS ใน completion report)
//   - Bugfix ที่จำเป็น: catch-all เดิม wrap ทุก error เป็น SystemException เสมอ ทำให้ exception
//     ชนิดต่างๆ (NotFoundException/ConflictException/ValidationException/BusinessException/
//     UnresolvedFieldsException) ไม่ propagate ออกไปตาม HTTP status ที่ถูกต้อง (ADR-007) —
//     แก้ให้ rethrow BaseException ตรงๆ, wrap เฉพาะ error ที่ไม่รู้จักเป็น SystemException

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
} from './entities/migration-review-queue.entity';
import { ImportTransaction } from './entities/import-transaction.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { Project } from '../project/entities/project.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { Rfa } from '../rfa/entities/rfa.entity';
import { RfaRevision } from '../rfa/entities/rfa-revision.entity';
import { AiAuditLog, AiAuditStatus } from '../ai/entities/ai-audit-log.entity';
import { Tag } from '../tags/entities/tag.entity';
import { CorrespondenceTag } from '../tags/entities/correspondence-tag.entity';
import {
  CommitMigrationReviewDto,
  TagDecisionDto,
} from './dto/commit-migration-review.dto';
import { UpdateQueueOcrDto } from './dto/update-queue-ocr.dto';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { RagBatchService } from './services/rag-batch.service';
import { MigrationService } from './migration.service';
import { ReviewThresholdService } from './services/review-threshold.service';
import type { TagSuggestion } from './types/ai-extraction-details.type';
import {
  BaseException,
  BusinessException,
  ConflictException,
  ErrorSeverity,
  ErrorType,
  NotFoundException,
  SystemException,
  ValidationException,
} from '../../common/exceptions';
import {
  RFA_TYPE_CODE_GENERIC,
  RFA_STATUS_CODE_APPROVED,
  CORRESPONDENCE_STATUS_CLBOWN,
  CORRESPONDENCE_STATUS_DRAFT,
  BATCH_ID_HUMAN_REVIEW,
  IMPORT_TX_STATUS_SUCCESS,
} from './constants/migration.constants';
import { linkAttachmentsToRevision } from './utils/attachment-linking.util';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import * as path from 'path';
import * as fs from 'fs-extra';

const readTagName = (value: Record<string, string>): string => {
  return value.name || value.tagName || '';
};

/** field ที่ commit gate ตรวจสอบได้ (ADR-050 §4/data-model.md §4, FR-013/FR-014) */
const GATED_FIELDS = [
  'ocrQuality',
  'summary',
  'correspondenceType',
  'tags',
] as const;
type GatedField = (typeof GATED_FIELDS)[number];

/**
 * ADR-050 FR-013/FR-014 — commit ถูก block เพราะมี field confidence ต่ำกว่า threshold
 * ที่ยังไม่ resolved (แก้ไขหรือรับทราบ) ครบทุก field ที่ trigger
 *
 * ขยายจาก BaseException ตรงๆ (ส่วนหนึ่งของ ADR-007 exception hierarchy เดียวกับ
 * BusinessException/ConflictException/ฯลฯ — ErrorType.BUSINESS_RULE → HTTP 422 เหมือนกัน)
 * แทนที่จะขยายจาก BusinessException เพราะ BusinessException ปัจจุบันไม่มีช่องทางส่ง
 * structured `details` ผ่าน constructor — จึงประกาศ `unresolvedFields` เป็น public property
 * บน exception instance โดยตรงด้วย เพื่อให้ทดสอบ/ผู้เรียกใช้อ่านค่าได้แน่นอนไม่ขึ้นกับ
 * NODE_ENV (payload.details ของ BaseException ถูกซ่อนใน production — ดู JUDGMENT CALLS)
 */
export class UnresolvedFieldsException extends BaseException {
  constructor(public readonly unresolvedFields: GatedField[]) {
    super(
      ErrorType.BUSINESS_RULE,
      'UNRESOLVED_FIELDS',
      `Commit blocked — unresolved low-confidence fields: ${unresolvedFields.join(', ')}`,
      'ยังมีข้อมูลที่ AI ไม่มั่นใจซึ่งต้องตรวจสอบก่อน commit กรุณาแก้ไขหรือยืนยันรับทราบ',
      ErrorSeverity.MEDIUM,
      { unresolvedFields },
      [
        'แก้ไขค่าของ field ที่มีความมั่นใจต่ำ',
        'หรือส่ง fieldAcknowledgments เพื่อยืนยันรับทราบและดำเนินการต่อ',
      ]
    );
  }

  // BaseException.getResponse() (จาก HttpException) omits `details` เมื่อ
  // NODE_ENV=production (base.exception.ts) และ GlobalExceptionFilter อ่านเฉพาะ
  // payload จาก getResponse() — override ตรงนี้เพื่อให้ unresolvedFields ติดไปกับ
  // response เสมอ ไม่ว่า NODE_ENV จะเป็นอะไร (frontend ต้องใช้ field นี้ตาม
  // UnresolvedFieldsError contract — FR-013/FR-014)
  override getResponse(): Record<string, unknown> {
    const base = super.getResponse() as { error: Record<string, unknown> };
    return {
      error: {
        ...base.error,
        unresolvedFields: this.unresolvedFields,
      },
    };
  }
}

@Injectable()
export class MigrationReviewService {
  private readonly logger = new Logger(MigrationReviewService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly uuidResolverService: UuidResolverService,
    private readonly ragBatchService: RagBatchService,
    private readonly fileStorageService: FileStorageService,
    private readonly migrationService: MigrationService,
    private readonly reviewThresholdService: ReviewThresholdService
  ) {}

  /**
   * อัปเดตข้อความ OCR 3 หน้าแรกไว้ใน queue (ADR-042/047)
   * RAG จะถูก trigger หลัง Execute Import โดยใช้ pipeline ปกติ (rag-prepare)
   */
  async updateQueueOcr(
    publicId: string,
    dto: UpdateQueueOcrDto,
    userId: number
  ) {
    const queueRepo = this.dataSource.getRepository(MigrationReviewQueue);
    const queueItem = await queueRepo.findOne({
      where: { publicId },
    });

    if (!queueItem) {
      throw new NotFoundException('MigrationReviewQueue', publicId);
    }

    queueItem.ocrText = dto.ocrText;
    queueItem.reviewedBy = userId.toString();
    queueItem.reviewedAt = new Date();
    await queueRepo.save(queueItem);

    return {
      success: true,
      message: 'OCR text updated for import',
      publicId: queueItem.publicId,
      ocrTextLength: dto.ocrText.length,
    };
  }

  /**
   * คืนรายการ attachment id ที่ใช้จริง โดยรองรับรูปแบบเดิมที่มีไฟล์เดียว (R4)
   * ถ้า tempAttachmentIds มีค่าจะใช้ค่านั้น; ถ้าไม่มีจะ fallback ไป [tempAttachmentId]
   * @returns รายการ attachment id (อาจว่าง)
   */
  private resolveAttachmentIds(record: MigrationReviewQueue): number[] {
    if (record.tempAttachmentIds && record.tempAttachmentIds.length > 0) {
      return record.tempAttachmentIds;
    }
    return record.tempAttachmentId ? [record.tempAttachmentId] : [];
  }

  /**
   * ADR-050 T016 — per-field commit gate (FR-013/FR-014, data-model.md §4)
   * คืนรายชื่อ field ที่ "trigger" (confidence < minConfidence) แต่ยังไม่ resolved
   * resolve ได้ 2 ทาง: (a) ผู้ตรวจสอบแก้ไขค่าจริง (category/summary ต่างจาก AI suggestion,
   * หรือส่ง tagDecisions มา — ถือเป็นการรีวิว tag แล้ว) (b) ระบุใน dto.fieldAcknowledgments
   * ocrQuality ไม่มีทาง "แก้ไข" ได้ — resolve ได้ทาง acknowledgment เท่านั้น
   * ถ้า queueItem ไม่มีข้อมูล confidence ใหม่เลย (legacy/manual item ที่ไม่เคยผ่าน AI extraction
   * ตาม ADR-050 contract) ถือว่าไม่มี field ใด trigger — คืน [] (ไม่ block)
   */
  private computeUnresolvedFields(
    queueItem: MigrationReviewQueue,
    dto: CommitMigrationReviewDto,
    minConfidence: number
  ): GatedField[] {
    const details = this.migrationService.parseExtractionDetails(
      queueItem.details
    );
    const ocrConfidence =
      queueItem.ocrQualityConfidence ?? details?.ocrQuality?.confidence;
    const metaConfidence = details?.metadata?.confidence;

    const confidenceOf: Record<GatedField, number | undefined> = {
      ocrQuality: typeof ocrConfidence === 'number' ? ocrConfidence : undefined,
      summary: metaConfidence?.summary,
      correspondenceType: metaConfidence?.correspondenceType,
      tags: metaConfidence?.tags,
    };

    const acknowledged = new Set(dto.fieldAcknowledgments ?? []);
    const unresolved: GatedField[] = [];

    for (const field of GATED_FIELDS) {
      const confidence = confidenceOf[field];
      if (typeof confidence !== 'number' || confidence >= minConfidence) {
        continue; // field นี้ไม่ trigger — confidence สูงพอ หรือไม่มีข้อมูลให้ประเมิน
      }
      if (acknowledged.has(field)) {
        continue; // resolved โดยการรับทราบ
      }
      let edited = false;
      if (field === 'summary') {
        // หมายเหตุ: CommitMigrationReviewDto ไม่มี field `summary` แยก (data-model.md §6 เป็น
        // sketch แบบย่อ ไม่ตรงกับ DTO จริงที่มี `subject`/`body` แทน) — ใช้ `dto.subject` เป็น
        // ตัวแทนค่าที่ผู้ตรวจสอบแก้ไข เพราะเป็น field ข้อความหลักที่ reviewer ปรับได้ตรงกับ
        // ตำแหน่งที่ AI summary ถูกเสนอ (ดู JUDGMENT CALLS ใน completion report)
        edited =
          dto.subject !== undefined &&
          dto.subject !== details?.metadata?.summary;
      } else if (field === 'correspondenceType') {
        edited =
          dto.correspondenceType !== undefined &&
          dto.correspondenceType !== details?.metadata?.correspondenceType;
      } else if (field === 'tags') {
        // การส่ง tagDecisions มา (ไม่ว่าง) ถือเป็น review action ของ tag ชุดนี้แล้ว (simplify)
        edited = Array.isArray(dto.tagDecisions) && dto.tagDecisions.length > 0;
      }
      // field === 'ocrQuality': ไม่มีทาง edit — resolve ได้ทาง acknowledgment เท่านั้น (ด้านบน)
      if (!edited) {
        unresolved.push(field);
      }
    }
    return unresolved;
  }

  /**
   * ADR-050 data-model.md §6 — ป้องกันการปลอม audit record: `tagDecisions[].name` ทุกตัว
   * ต้องตรงกับ tag ที่ AI เสนอจริงใน `details.metadata.tags[]` (case-insensitive)
   * ถ้า queue item ไม่มี tag suggestion เลย (legacy/manual item) ข้ามการตรวจนี้ไป —
   * ไม่มีข้อมูลอ้างอิงให้ตรวจสอบ
   */
  private validateTagDecisionNames(
    tagDecisions: TagDecisionDto[],
    suggestedTags: TagSuggestion[] | undefined
  ): void {
    if (!suggestedTags || suggestedTags.length === 0) return;
    const suggestedNames = new Set(
      suggestedTags.map((t) => t.name.trim().toLowerCase())
    );
    const unknown = tagDecisions.filter(
      (d) => !suggestedNames.has(d.name.trim().toLowerCase())
    );
    if (unknown.length > 0) {
      throw new ValidationException(
        `tagDecisions มีชื่อ tag ที่ไม่ตรงกับที่ AI เสนอสำหรับรายการนี้: ${unknown
          .map((d) => d.name)
          .join(', ')}`
      );
    }
  }

  /** lookup/create tag แล้ว link เข้ากับ correspondence (ใช้ร่วมกันทั้ง tagDecisions accepted path และ legacy extractedTags fallback) */
  private async linkTagToCorrespondence(
    manager: EntityManager,
    projectId: number,
    correspondenceId: number,
    tagName: string,
    userId: number,
    isAiSuggested: boolean
  ): Promise<void> {
    const existingTag = await manager.findOne(Tag, {
      where: { projectId, tagName },
    });
    let tagId: number;
    if (existingTag) {
      tagId = existingTag.id;
    } else {
      const newTag = await manager.save(Tag, {
        projectId,
        tagName,
        createdBy: userId,
      });
      tagId = newTag.id;
    }
    const existingLink = await manager.findOne(CorrespondenceTag, {
      where: { correspondenceId, tagId },
    });
    if (!existingLink) {
      await manager.save(CorrespondenceTag, {
        correspondenceId,
        tagId,
        isAiSuggested,
        createdBy: userId,
      });
    }
  }

  /**
   * ADR-050 T018 (FR-006/FR-007/FR-008) — บันทึก audit trail สำหรับ tag ที่ผู้ตรวจสอบ reject
   * ai_audit_logs (entity จริง) ไม่มีคอลัมน์ action/payload_json/queue_item_public_id/actor_user_id
   * ตามที่ data-model.md §5 อธิบายไว้ (ตารางนั้นออกแบบสำหรับ AI model interaction log ทั่วไป) —
   * map เนื้อหาความหมายเดียวกัน (ใครปฏิเสธ, เมื่อไหร่, เสนออะไรมา) ไปยัง column ที่มีอยู่จริงแทน:
   * aiSuggestionJson = สิ่งที่ AI เสนอ (tagName/evidence/isNew), humanOverrideJson = การตัดสินใจ
   * ของมนุษย์ (reject), confirmedByUserId = ผู้ตรวจสอบ (actor), documentPublicId = queue item
   * ดู JUDGMENT CALLS ใน completion report
   */
  private async recordTagRejectionAudit(
    manager: EntityManager,
    queueItemPublicId: string,
    decision: TagDecisionDto,
    original: TagSuggestion | undefined,
    userId: number
  ): Promise<void> {
    const log = manager.create(AiAuditLog, {
      documentPublicId: queueItemPublicId,
      aiModel: 'np-dms-ai',
      modelName: 'ocr_extraction',
      canonicalModel: 'np-dms-ai',
      status: AiAuditStatus.SUCCESS,
      aiSuggestionJson: {
        tagName: decision.name,
        evidence: decision.evidence ?? original?.evidence,
        isNew: original?.isNew ?? false,
      },
      humanOverrideJson: { action: 'TAG_REJECTED' },
      confirmedByUserId: userId,
    });
    await manager.save(AiAuditLog, log);
  }

  /**
   * ทำการ Commit ข้อมูลเอกสารจาก Staging Review Queue เข้าระบบจริงอย่างเป็นระบบ
   * มีการทำ SELECT FOR UPDATE เพื่อป้องกันการกดเบิ้ลหรือการทำงานพร้อมกัน
   *
   * @param idempotencyKey Idempotency-Key header จาก client (ADR-016) —
   *   บันทึกลง import_transactions เพื่อตรวจจับ duplicate submit จริง
   */
  async commitRecord(
    dto: CommitMigrationReviewDto,
    userId: number,
    idempotencyKey: string
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // ADR-016: ตรวจจับ duplicate submit จริงด้วย idempotencyKey ใน DB
      const existingTx = await queryRunner.manager.findOne(ImportTransaction, {
        where: { idempotencyKey },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingTx) {
        if (existingTx.statusCode === 201) {
          return {
            success: true,
            message: 'Already processed (idempotency replay)',
            transactionId: existingTx.id,
          };
        }
        throw new ConflictException(
          'MIGRATION_DUPLICATE_TRANSACTION',
          `Transaction failed previously with status ${existingTx.statusCode}`,
          'รายการนี้เคยดำเนินการไปแล้วและล้มเหลว',
          ['ตรวจสอบสถานะ Transaction ก่อนหน้า', 'ลองใช้ Idempotency-Key ใหม่']
        );
      }

      const queueItem = await queryRunner.manager.findOne(
        MigrationReviewQueue,
        {
          where: { publicId: dto.publicId },
          lock: { mode: 'pessimistic_write' },
        }
      );
      if (!queueItem) {
        throw new NotFoundException(
          'Migration review record not found',
          dto.publicId
        );
      }
      // ADR-050 T014 (remainder, FR-011/SC-006): item ที่ AI extraction เสร็จแล้ว (aiStatus=DONE)
      // แต่ details ยังเป็น pre-ADR-050 shape (ไม่มี metadata.confidence ครบ) ต้อง re-extract ก่อน
      // ถึงจะ commit ได้ — mirror MigrationService.isLegacyExtractionShape() (review-mode-fetch half)
      if (this.migrationService.isLegacyExtractionShape(queueItem)) {
        throw new BusinessException(
          'LEGACY_EXTRACTION_SHAPE_NOT_COMMITTABLE',
          `Queue item ${queueItem.publicId} was extracted before ADR-050 and lacks metadata.confidence — must be re-extracted before it can be committed`,
          'รายการนี้ประมวลผลด้วยระบบเก่า กรุณาสั่ง re-extract ก่อนจึงจะ commit ได้',
          ['สั่ง re-extract รายการนี้ก่อน', 'ตรวจสอบสถานะ AI extraction']
        );
      }
      if (queueItem.status !== MigrationReviewStatus.PENDING) {
        throw new ConflictException(
          'MIGRATION_ALREADY_PROCESSING',
          `Staging record is already processed with status: ${queueItem.status}`,
          'รายการนี้ได้รับการประมวลผลไปแล้ว',
          ['กรุณาตรวจสอบหน้า Review Queue อีกครั้งเพื่อความถูกต้อง']
        );
      }
      // ADR-050 T016 (FR-013/FR-014): commit gate — block ถ้ามี field confidence ต่ำกว่า
      // threshold ที่ยังไม่ resolved (แก้ไข/รับทราบ)
      const { minConfidence } =
        await this.reviewThresholdService.getThresholds();
      const unresolvedFields = this.computeUnresolvedFields(
        queueItem,
        dto,
        minConfidence
      );
      if (unresolvedFields.length > 0) {
        throw new UnresolvedFieldsException(unresolvedFields);
      }
      const rawProjectId = dto.projectId ?? queueItem.projectId;
      if (!rawProjectId) {
        throw new ValidationException('Project ID is required');
      }
      const resolvedProjectId =
        await this.uuidResolverService.resolveProjectId(rawProjectId);
      const project = await queryRunner.manager.findOne(Project, {
        where: { id: resolvedProjectId },
      });
      if (!project) {
        throw new NotFoundException('Project', String(resolvedProjectId));
      }
      const correspondenceType =
        dto.correspondenceType ?? queueItem.aiSuggestedCorrespondenceType;
      if (!correspondenceType) {
        throw new ValidationException('Correspondence Type is required');
      }
      // ADR-050 T017 (FR-005/SC-003): correspondenceType ที่จะ commit ต้องอยู่ใน correspondence_types.typeCode
      // (จริง — ไม่ใช่แค่ prompt-time restriction ที่ T007 ทำไปแล้ว) ป้องกันเขียนหมวดหมู่นอกรายการ
      const allowedCorrespondenceTypeCodes =
        await this.migrationService.getAllowedCategoryCodes();
      if (!allowedCorrespondenceTypeCodes.includes(correspondenceType)) {
        throw new BusinessException(
          'CATEGORY_NOT_ALLOWED',
          `Correspondence Type "${correspondenceType}" is not in the allowed correspondence_types.typeCode list`,
          `ประเภทเอกสาร "${correspondenceType}" ไม่อยู่ในรายการที่ระบบอนุญาต`,
          ['เลือกหมวดหมู่จากรายการที่ระบบกำหนด (correspondence_types)']
        );
      }
      // หมายเหตุ: การ gate T017 ด้านบนบังคับให้ correspondenceType ต้องเป็น typeCode ตรงตัวอยู่แล้ว —
      // alias map ด้านล่างนี้จึงไม่ถูกใช้งานจริงอีกต่อไปสำหรับ commit path ใหม่ (unreachable
      // สำหรับค่า alias เดิมอย่าง "Correspondence"/"Drawing"/ฯลฯ) คงไว้เพื่อลด blast radius —
      // ไม่อยู่ใน scope ของ FOUND-COMMIT (ADR-050 §1 สั่งลบเฉพาะ map ใน migration.service.ts)
      const CATEGORY_ALIAS: Record<string, string> = {
        Correspondence: 'LETTER',
        Letter: 'LETTER',
        Drawing: 'OTHER',
        Report: 'OTHER',
        Other: 'OTHER',
      };
      const type = await queryRunner.manager.findOne(CorrespondenceType, {
        where: { typeName: correspondenceType },
      });
      let typeId = type
        ? type.id
        : (
            await queryRunner.manager.findOne(CorrespondenceType, {
              where: { typeCode: correspondenceType },
            })
          )?.id;
      if (!typeId && CATEGORY_ALIAS[correspondenceType]) {
        typeId = (
          await queryRunner.manager.findOne(CorrespondenceType, {
            where: { typeCode: CATEGORY_ALIAS[correspondenceType] },
          })
        )?.id;
      }
      if (!typeId) {
        throw new ValidationException(
          `Correspondence Type "${correspondenceType}" not found in system`
        );
      }
      let status = await queryRunner.manager.findOne(CorrespondenceStatus, {
        where: { statusCode: CORRESPONDENCE_STATUS_CLBOWN },
      });
      if (!status) {
        status = await queryRunner.manager.findOne(CorrespondenceStatus, {
          where: { statusCode: CORRESPONDENCE_STATUS_DRAFT },
        });
      }
      if (!status) {
        throw new SystemException(
          'No default correspondence status found (missing CLBOWN/DRAFT)'
        );
      }
      const docNum = queueItem.documentNumber;
      let correspondence = await queryRunner.manager.findOne(Correspondence, {
        where: {
          correspondenceNumber: docNum,
          projectId: project.id,
        },
      });
      const rawSenderId = dto.senderId ?? queueItem.senderOrganizationId;
      const resolvedSenderId = rawSenderId
        ? await this.uuidResolverService.resolveOrganizationId(rawSenderId)
        : undefined;
      const rawReceiverId = dto.receiverId ?? queueItem.receiverOrganizationId;
      const resolvedReceiverId = rawReceiverId
        ? await this.uuidResolverService.resolveOrganizationId(rawReceiverId)
        : undefined;
      if (!correspondence) {
        correspondence = queryRunner.manager.create(Correspondence, {
          correspondenceNumber: docNum,
          correspondenceTypeId: typeId,
          projectId: project.id,
          originatorId: resolvedSenderId || undefined,
          isInternal: false,
          createdBy: userId,
        });
        await queryRunner.manager.save(correspondence);
        const isRFA = type?.typeCode === 'RFA' || correspondenceType === 'RFA';
        if (isRFA) {
          const rfaTypeRes = await queryRunner.manager.query<{ id: number }[]>(
            'SELECT id FROM rfa_types WHERE type_code = ? LIMIT 1',
            [RFA_TYPE_CODE_GENERIC]
          );
          if (!rfaTypeRes[0]?.id) {
            // ADR-016/007: ห้าม fallback ค่า Master Data อัตโนมัติ — throw เพื่อ
            // ป้องกัน data corruption และบังคับให้ DBA ตรวจสอบ seed data
            throw new BusinessException(
              'RFA_TYPE_NOT_FOUND',
              `RFA type '${RFA_TYPE_CODE_GENERIC}' not found in rfa_types — seed data missing`,
              'ไม่พบประเภท RFA ในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบข้อมูลมาตรฐาน',
              [
                'ติดต่อผู้ดูแลระบบ',
                'ตรวจสอบตาราง rfa_types ว่ามี type_code=GEN',
              ]
            );
          }
          const rfa = queryRunner.manager.create(Rfa, {
            id: correspondence.id,
            rfaTypeId: rfaTypeRes[0].id,
            createdBy: userId,
          });
          await queryRunner.manager.save(Rfa, rfa);
        }
      } else {
        let hasChanges = false;
        if (resolvedSenderId && !correspondence.originatorId) {
          correspondence.originatorId = resolvedSenderId;
          hasChanges = true;
        }
        if (hasChanges) {
          await queryRunner.manager.save(correspondence);
        }
      }
      if (resolvedReceiverId) {
        await queryRunner.manager.query(
          'INSERT IGNORE INTO correspondence_recipients (correspondence_id, recipient_organization_id, recipient_type) VALUES (?, ?, ?)',
          [correspondence.id, resolvedReceiverId, 'TO']
        );
      }
      // Feature 242: Multi-attachment support (FR-001, FR-002, FR-003)
      // ใช้ resolveAttachmentIds เพื่อรองรับทั้ง tempAttachmentIds ใหม่และ tempAttachmentId เดิม (R4)
      const attachmentIds = this.resolveAttachmentIds(queueItem);
      if (attachmentIds.length === 0) {
        // Edge Case: missing attachment — ส่ง 400 พร้อม Thai userMessage
        throw new ValidationException(
          'ไม่พบไฟล์แนบในรายการรีวิว — กรุณาตรวจสอบว่ามีการอัปโหลดไฟล์ก่อน commit'
        );
      }
      // ตรวจสอบว่า attachment IDs ทั้งหมดมีอยู่จริงในระบบ
      for (const attId of attachmentIds) {
        const exists = await queryRunner.manager.findOne(Attachment, {
          where: { id: attId },
          select: ['id'],
        });
        if (!exists) {
          throw new ValidationException(
            `ไม่พบไฟล์แนบ ID ${attId} ในระบบ — กรุณาตรวจสอบรายการรีวิว`
          );
        }
      }
      // ย้ายไฟล์จาก tempDir ไป permanent/{docType}/{YYYY}/{MM}/ โดยใช้วันที่เอกสาร
      // ก่อนนี้ไฟล์ติดอยู่ใน tempDir ตลอดเพราะ commitRecord ไม่ได้เรียก commit()
      const parseDateForFolder = (d?: string | Date) => {
        if (!d) return new Date();
        if (d instanceof Date) return isNaN(d.getTime()) ? new Date() : d;
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      };
      const issuedDateForFolder = parseDateForFolder(
        dto.issuedDate ?? queueItem.issuedDate
      );
      const docTypeForFolder =
        dto.correspondenceType ??
        queueItem.aiSuggestedCorrespondenceType ??
        'General';
      const yearFolder = issuedDateForFolder.getFullYear().toString();
      const monthFolder = (issuedDateForFolder.getMonth() + 1)
        .toString()
        .padStart(2, '0');
      const permanentDir = path.join(
        this.fileStorageService.permanentDir,
        docTypeForFolder,
        yearFolder,
        monthFolder
      );
      await fs.ensureDir(permanentDir);

      // ทำเครื่องหมาย attachments ทั้งหมดเป็นถาวร (isTemporary = false)
      // พร้อมย้ายไฟล์จาก tempDir ไป permanentDir และบันทึก OCR text (ADR-042/047)
      for (let attIndex = 0; attIndex < attachmentIds.length; attIndex += 1) {
        const attId = attachmentIds[attIndex];
        const attRecord = await queryRunner.manager.findOne(Attachment, {
          where: { id: attId },
          select: ['id', 'filePath', 'storedFilename'],
        });
        if (attRecord && attRecord.filePath) {
          const oldPath = attRecord.filePath;
          // ตรวจสอบว่าไฟล์ยู่ใน tempDir ก่อนย้าย (ถ้าอยู่ใน permanent แล้วไม่ต้องย้าย)
          const isInTemp = oldPath.startsWith(this.fileStorageService.tempDir);
          if (isInTemp && (await fs.pathExists(oldPath))) {
            const newPath = path.join(
              permanentDir,
              attRecord.storedFilename || path.basename(oldPath)
            );
            try {
              await fs.move(oldPath, newPath, { overwrite: true });
              await queryRunner.manager.update(
                Attachment,
                { id: attId },
                { filePath: newPath, referenceDate: issuedDateForFolder }
              );
            } catch (moveErr: unknown) {
              const msg =
                moveErr instanceof Error ? moveErr.message : String(moveErr);
              this.logger.warn(
                `Failed to move attachment id=${attId} from temp to permanent: ${msg}`
              );
            }
          }
        }
        const attUpdate: Record<string, unknown> = { isTemporary: false };
        if (attIndex === 0 && queueItem.ocrText) {
          attUpdate.ocrText = queueItem.ocrText;
        }
        await queryRunner.manager.update(Attachment, { id: attId }, attUpdate);
      }
      const attachmentId = attachmentIds[0]; // เอกสารหลัก (FR-003)
      const parseDateStr = (d?: string | Date) => {
        if (!d) return undefined;
        if (d instanceof Date) return d;
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? undefined : parsed;
      };
      const finalSubject =
        dto.subject ??
        queueItem.subject ??
        queueItem.originalSubject ??
        'No Subject';
      // ADR-042/047: ใช้ ocrText เป็น body ของเอกสารถ้ายังไม่มี body จากผู้ตรวจทาน
      const finalBody = dto.body || queueItem.body || queueItem.ocrText || '';
      const issuedDateStr =
        dto.issuedDate ??
        (queueItem.issuedDate ? queueItem.issuedDate.toISOString() : undefined);
      const receivedDateStr =
        dto.receivedDate ??
        (queueItem.receivedDate
          ? queueItem.receivedDate.toISOString()
          : undefined);
      // ADR-002: ป้องกัน revision race condition — ใช้ pessimistic lock ค้นหา
      // revision ปัจจุบันแทน count() ที่อ่าน snapshot แล้ว race กับ concurrent tx
      const currentRevisions = await queryRunner.manager.find(
        CorrespondenceRevision,
        {
          where: { correspondenceId: correspondence.id },
          lock: { mode: 'pessimistic_write' },
          order: { revisionNumber: 'DESC' },
        }
      );
      const revisionCount = currentRevisions.length;
      const revNum = revisionCount;
      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: correspondence.id,
        revisionNumber: revNum,
        revisionLabel: revNum === 0 ? '0' : revNum.toString(),
        isCurrent: true,
        statusId: status.id,
        subject: finalSubject,
        description: 'Migrated from legacy system via Human Reviewed Commit',
        body: finalBody || undefined,
        documentDate: parseDateStr(issuedDateStr),
        issuedDate: parseDateStr(issuedDateStr),
        receivedDate: parseDateStr(receivedDateStr),
        details: {
          ai_confidence: queueItem.aiConfidence,
          ai_issues: queueItem.aiIssues,
          attachment_id: attachmentId,
          attachment_ids: attachmentIds,
          // Feature 242: บันทึก fieldResolutions ของผู้ตรวจสอบใน audit trail (FR-011b, R7)
          field_resolutions: dto.fieldResolutions,
          compare_status: queueItem.compareStatus,
        },
        schemaVersion: 1,
        createdBy: userId,
      });
      if (revisionCount > 0) {
        await queryRunner.manager.update(
          CorrespondenceRevision,
          { correspondenceId: correspondence.id, isCurrent: true },
          { isCurrent: false }
        );
      }
      await queryRunner.manager.save(revision);
      // Feature 242: เชื่อม attachments ทั้งหมดเข้ากับ revision ผ่าน junction table (FR-001, FR-002, FR-003)
      // Bugfix: เดิมใช้ column name "revision_id" ซึ่งผิด (คอลัมน์จริงคือ "correspondence_revision_id")
      // ทำให้ INSERT ล้มเหลวเสมอ — เปลี่ยนไปใช้ shared utility เพื่อป้องกัน column name drift
      await linkAttachmentsToRevision(
        queryRunner.manager,
        revision.id,
        attachmentIds
      );
      const isRFA = type?.typeCode === 'RFA' || docTypeForFolder === 'RFA';
      if (isRFA) {
        const rfaStatusRes = await queryRunner.manager.query<{ id: number }[]>(
          'SELECT id FROM rfa_status_codes WHERE status_code = ? LIMIT 1',
          [RFA_STATUS_CODE_APPROVED]
        );
        if (!rfaStatusRes[0]?.id) {
          // ADR-016/007: ห้าม fallback ค่า Master Data อัตโนมัติ — throw เพื่อ
          // ป้องกัน data corruption และบังคับให้ DBA ตรวจสอบ seed data
          throw new BusinessException(
            'RFA_STATUS_NOT_FOUND',
            `RFA status '${RFA_STATUS_CODE_APPROVED}' not found in rfa_status_codes — seed data missing`,
            'ไม่พบสถานะ RFA Approved ในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบข้อมูลมาตรฐาน',
            [
              'ติดต่อผู้ดูแลระบบ',
              'ตรวจสอบตาราง rfa_status_codes ว่ามี status_code=APP',
            ]
          );
        }
        const rfaRev = queryRunner.manager.create(RfaRevision, {
          id: revision.id,
          rfaStatusCodeId: rfaStatusRes[0].id,
          details: { drawingCount: 0 },
          schemaVersion: 1,
        });
        await queryRunner.manager.save(RfaRevision, rfaRev);
      }
      // ADR-050 T018 (FR-006/FR-007/FR-008) — BREAKING CHANGE: แทนที่ dto.tags: string[] เดิม
      // ด้วย dto.tagDecisions[] — ผูกเฉพาะ tag ที่ accepted=true เข้าเอกสาร, บันทึก audit trail
      // สำหรับทุก tag ที่ reject ว่าใครปฏิเสธ เมื่อไหร่ และ AI เสนออะไรมา
      const tagDecisions = dto.tagDecisions ?? [];
      if (tagDecisions.length > 0) {
        const detailsForTags = this.migrationService.parseExtractionDetails(
          queueItem.details
        );
        const suggestedTags = detailsForTags?.metadata?.tags;
        this.validateTagDecisionNames(tagDecisions, suggestedTags);
        for (const decision of tagDecisions) {
          const tagName = decision.name.trim().toLowerCase();
          if (!tagName) continue;
          if (decision.accepted) {
            await this.linkTagToCorrespondence(
              queryRunner.manager,
              project.id,
              correspondence.id,
              tagName,
              userId,
              true // is_ai_suggested — tag นี้มาจาก AI suggestion ที่ผู้ตรวจสอบยอมรับ
            );
          } else {
            const original = suggestedTags?.find(
              (t) => t.name.trim().toLowerCase() === tagName
            );
            await this.recordTagRejectionAudit(
              queryRunner.manager,
              queueItem.publicId,
              decision,
              original,
              userId
            );
          }
        }
      } else if (
        queueItem.extractedTags &&
        Array.isArray(queueItem.extractedTags)
      ) {
        // Backward-compat fallback: item ที่ไม่มี tagDecisions ชัดเจน (เช่น legacy/manual item
        // ที่ไม่ผ่าน ADR-050 AI extraction contract) — ผูก extractedTags ทั้งหมดเหมือนเดิม
        const legacyTagNames = queueItem.extractedTags
          .map((tag) => readTagName(tag))
          .filter(Boolean);
        for (const rawTagName of legacyTagNames) {
          const tagName = rawTagName.trim().toLowerCase();
          if (!tagName) continue;
          // R7: register-derived tags ต้องมี is_ai_suggested=0 (deterministic, ไม่ใช่ AI suggestion)
          await this.linkTagToCorrespondence(
            queryRunner.manager,
            project.id,
            correspondence.id,
            tagName,
            userId,
            false
          );
        }
      }
      // ADR-016: ใช้ idempotencyKey จริงจาก caller (ไม่ generate ภายใน) เพื่อ
      // ให้ duplicate submit ที่ใช้ key เดิมถูกตรวจจับที่ด้านบนของ method
      const transaction = queryRunner.manager.create(ImportTransaction, {
        idempotencyKey,
        documentNumber: docNum,
        batchId: BATCH_ID_HUMAN_REVIEW,
        statusCode: IMPORT_TX_STATUS_SUCCESS,
      });
      await queryRunner.manager.save(transaction);
      queueItem.status = MigrationReviewStatus.IMPORTED;
      queueItem.reviewedBy = userId.toString();
      queueItem.reviewedAt = new Date();
      await queryRunner.manager.save(queueItem);
      await queryRunner.commitTransaction();

      // FR-011: Trigger RAG re-embed หลัง commit เสร็จ (ADR-042/047)
      // ใช้ rag-prepare pipeline เดียวกับเอกสารปกติ โดยส่ง ocrText ผ่าน cachedOcrText
      if (queueItem.ocrText && queueItem.ocrText.trim().length > 0) {
        const mainAttachment = await queryRunner.manager.findOne(Attachment, {
          where: { id: attachmentId },
          select: ['publicId', 'filePath'],
        });
        if (mainAttachment) {
          try {
            await this.ragBatchService.enqueueRagPrepare({
              documentPublicId: correspondence.publicId,
              projectPublicId: project.publicId,
              correspondenceNumber: correspondence.correspondenceNumber,
              docType: type?.typeCode || 'LETTER',
              statusCode: status.statusCode,
              revisionNumber: revision.revisionNumber,
              subject: revision.subject,
              documentDate: revision.documentDate
                ? revision.documentDate.toISOString().split('T')[0]
                : undefined,
              cachedOcrText: queueItem.ocrText,
              attachmentPath: mainAttachment.filePath || undefined,
              attachmentPublicId: mainAttachment.publicId,
            });
          } catch (embedErr: unknown) {
            // ไม่ throw — commit สำเร็จแล้ว การ embed ล้มเหลวไม่ควร rollback
            const embedMsg =
              embedErr instanceof Error ? embedErr.message : String(embedErr);
            this.logger.warn(
              `Post-commit RAG re-embed failed for [${queueItem.publicId}]: ${embedMsg}`
            );
          }
        }
      }

      return {
        success: true,
        message: 'Staging record successfully imported',
        correspondencePublicId: correspondence.publicId,
        publicId: queueItem.publicId,
        status: queueItem.status,
      };
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      // ADR-007: exception ที่เป็นส่วนหนึ่งของ hierarchy อยู่แล้ว (NotFoundException/
      // ConflictException/ValidationException/BusinessException/UnresolvedFieldsException/ฯลฯ)
      // ต้อง propagate ตรงๆ เพื่อให้ HTTP status/response shape ถูกต้อง (404/409/400/422) —
      // wrap เป็น SystemException (500) เฉพาะ error ที่ไม่รู้จัก/ไม่คาดคิดเท่านั้น
      if (error instanceof BaseException) {
        throw error;
      }
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new SystemException(
        'Failed to commit review queue record: ' + errMsg
      );
    } finally {
      await queryRunner.release();
    }
  }
}
