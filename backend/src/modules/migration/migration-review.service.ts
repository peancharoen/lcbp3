// File: src/modules/migration/migration-review.service.ts
// Change Log:
// - 2026-05-22: Initial creation for US2 - Migration Review Queue Commit (T020a)
// - 2026-05-22: Integrated UuidResolverService to resolve hybrid identifiers (T020a)
// - 2026-08-17: ADR-016/002/007 compliance — รับ idempotencyKey จริง, ลบ hardcoded
// - 2026-08-23: Execute Import บันทึก ocrText ลง Attachment.ocr_text และ Revision.body
//   fallback `|| 1` / `|| 3`, ใช้ BusinessException สำหรับ missing master data,
//   ใช้ SELECT FOR UPDATE ป้องกัน revision race condition (Issue #3)

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
import { CommitMigrationReviewDto } from './dto/commit-migration-review.dto';
import { UpdateQueueOcrDto } from './dto/update-queue-ocr.dto';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { RagBatchService } from './services/rag-batch.service';
import {
  BusinessException,
  ConflictException,
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

const readTagName = (value: Record<string, string>): string => {
  return value.name || value.tagName || '';
};

@Injectable()
export class MigrationReviewService {
  private readonly logger = new Logger(MigrationReviewService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly uuidResolverService: UuidResolverService,
    private readonly ragBatchService: RagBatchService
  ) {}

  /**
   * อัปเดตข้อความ OCR 3 หน้าแรก และส่ง Re-embed ลง Qdrant อัตโนมัติ (ADR-042/047)
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

    // If reEmbed is requested (default true), trigger RAG embedding
    if (dto.reEmbed !== false && queueItem.projectId) {
      const project = await this.dataSource.getRepository(Project).findOne({
        where: { id: queueItem.projectId },
      });
      if (project) {
        // ดึง pdfPath จาก details.source_file_path ที่ ingestion เก็บไว้ (ADR-047)
        const details = queueItem.details as Record<string, unknown> | null;
        const pdfPath =
          details && typeof details.source_file_path === 'string'
            ? details.source_file_path
            : undefined;
        await this.ragBatchService.triggerEmbeddingForQueueItem(
          queueItem.publicId,
          project.publicId,
          dto.ocrText,
          pdfPath
        );
      }
    }

    return {
      success: true,
      message: 'OCR text updated and queued for RAG re-embedding',
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
      if (queueItem.status !== MigrationReviewStatus.PENDING) {
        throw new ConflictException(
          'MIGRATION_ALREADY_PROCESSING',
          `Staging record is already processed with status: ${queueItem.status}`,
          'รายการนี้ได้รับการประมวลผลไปแล้ว',
          ['กรุณาตรวจสอบหน้า Review Queue อีกครั้งเพื่อความถูกต้อง']
        );
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
      const category = dto.category ?? queueItem.aiSuggestedCategory;
      if (!category) {
        throw new ValidationException('Category is required');
      }
      const CATEGORY_ALIAS: Record<string, string> = {
        Correspondence: 'LETTER',
        Letter: 'LETTER',
        Drawing: 'OTHER',
        Report: 'OTHER',
        Other: 'OTHER',
      };
      const type = await queryRunner.manager.findOne(CorrespondenceType, {
        where: { typeName: category },
      });
      let typeId = type
        ? type.id
        : (
            await queryRunner.manager.findOne(CorrespondenceType, {
              where: { typeCode: category },
            })
          )?.id;
      if (!typeId && CATEGORY_ALIAS[category]) {
        typeId = (
          await queryRunner.manager.findOne(CorrespondenceType, {
            where: { typeCode: CATEGORY_ALIAS[category] },
          })
        )?.id;
      }
      if (!typeId) {
        throw new ValidationException(
          `Category "${category}" not found in system`
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
        const isRFA = type?.typeCode === 'RFA' || category === 'RFA';
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
      // ทำเครื่องหมาย attachments ทั้งหมดเป็นถาวร (isTemporary = false)
      // พร้อมบันทึก OCR text 3 หน้าแรกลง attachment หลัก (ADR-042/047)
      for (let attIndex = 0; attIndex < attachmentIds.length; attIndex += 1) {
        const attUpdate: Record<string, unknown> = { isTemporary: false };
        if (attIndex === 0 && queueItem.ocrText) {
          attUpdate.ocrText = queueItem.ocrText;
        }
        await queryRunner.manager.update(
          Attachment,
          { id: attachmentIds[attIndex] },
          attUpdate
        );
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
      // element [0] คือเอกสารหลัก (is_main_document=1), ที่เหลือเป็นเอกสารรอง (is_main_document=0)
      for (let i = 0; i < attachmentIds.length; i += 1) {
        await queryRunner.manager.query(
          'INSERT IGNORE INTO correspondence_revision_attachments (revision_id, attachment_id, is_main_document) VALUES (?, ?, ?)',
          [revision.id, attachmentIds[i], i === 0 ? 1 : 0]
        );
      }
      const isRFA = type?.typeCode === 'RFA' || category === 'RFA';
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
      let tagsToLink: string[] = [];
      if (dto.tags && dto.tags.length > 0) {
        tagsToLink = dto.tags;
      } else if (
        queueItem.extractedTags &&
        Array.isArray(queueItem.extractedTags)
      ) {
        tagsToLink = queueItem.extractedTags
          .map((tag) => readTagName(tag))
          .filter(Boolean);
      }
      for (const rawTagName of tagsToLink) {
        const tagName = rawTagName.trim().toLowerCase();
        if (!tagName) continue;
        const tagRes = await queryRunner.manager.query<{ id: number }[]>(
          'SELECT id FROM tags WHERE project_id = ? AND tag_name = ? LIMIT 1',
          [project.id, tagName]
        );
        let tagId: number;
        if (tagRes && tagRes.length > 0) {
          tagId = tagRes[0].id;
        } else {
          const insertRes = await queryRunner.manager.query<{
            insertId: number;
          }>(
            "INSERT INTO tags (project_id, tag_name, color_code, created_by) VALUES (?, ?, 'default', ?)",
            [project.id, tagName, userId]
          );
          tagId = insertRes.insertId;
        }
        // R7: register-derived tags ต้องมี is_ai_suggested=0 (deterministic, ไม่ใช่ AI suggestion)
        await queryRunner.manager.query(
          'INSERT IGNORE INTO correspondence_tags (correspondence_id, tag_id, is_ai_suggested) VALUES (?, ?, 0)',
          [correspondence.id, tagId]
        );
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
      // ใช้ OCR text จาก queue item เป็น source สำหรับ embedding
      if (queueItem.ocrText && queueItem.ocrText.trim().length > 0) {
        const details = queueItem.details as Record<string, unknown> | null;
        const pdfPath =
          details && typeof details.source_file_path === 'string'
            ? details.source_file_path
            : undefined;
        try {
          await this.ragBatchService.triggerEmbeddingForQueueItem(
            queueItem.publicId,
            project.publicId,
            queueItem.ocrText,
            pdfPath
          );
        } catch (embedErr: unknown) {
          // ไม่ throw — commit สำเร็จแล้ว การ embed ล้มเหลวไม่ควร rollback
          const embedMsg =
            embedErr instanceof Error ? embedErr.message : String(embedErr);
          this.logger.warn(
            `Post-commit RAG re-embed failed for [${queueItem.publicId}]: ${embedMsg}`
          );
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
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new SystemException(
        'Failed to commit review queue record: ' + errMsg
      );
    } finally {
      await queryRunner.release();
    }
  }
}
