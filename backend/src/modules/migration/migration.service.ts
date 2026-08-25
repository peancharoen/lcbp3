// File: backend/src/modules/migration/migration.service.ts
// Change Log:
// - 2026-08-23: ใช้ disciplineId (INT) โดยตรง, แก้ recipient lookup ให้แยก recipientType: TO
// - 2026-08-22: Persist IMPORTED after approve-and-import to match the database enum
// - 2026-08-22: เพิ่ม startExtractQueueItem / startExtractBatch และปรับ execute import flow ตาม ADR-047
// - 2026-08-23: Execute Import บันทึก ocrText ลง Attachment/Revision และใช้ rag-prepare pipeline เดียวกับเอกสารปกติ
// - 2026-08-25: นำ remarks จาก Excel → correspondence_revisions.remarks (approve fallback จาก queueItem)
// - 2026-08-25: เพิ่ม LEGACY_NAS_PATH ใน getStagingFileStream allowed roots (D157)
// - 2026-08-25: RAG trigger ไม่ต้องมี ocrText — processRagPrepare ทำ OCR เองได้ (D158)
// - 2026-08-25: revision.body ใช้ aiSummary (AI สรุป) แทน ocrText (OCR ดิบ) — D159

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  BusinessException,
  ConflictException,
  NotFoundException,
  SystemException,
  ValidationException,
} from '../../common/exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  In,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { EnqueueMigrationDto } from './dto/enqueue-migration.dto';
import { CommitBatchDto } from './dto/commit-batch.dto';
import { CreateMigrationErrorDto } from './dto/create-migration-error.dto';
import { ImportTransaction } from './entities/import-transaction.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { CorrespondenceRecipient } from '../correspondence/entities/correspondence-recipient.entity';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Discipline } from '../master/entities/discipline.entity';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
  MigrationAiStatus,
} from './entities/migration-review-queue.entity';
import { MigrationError } from './entities/migration-error.entity';
import { MigrationQueueQueryDto } from './dto/migration-queue-query.dto';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { createReadStream, existsSync } from 'fs';
import * as path from 'path';
import { RagBatchService } from './services/rag-batch.service';
import { Rfa } from '../rfa/entities/rfa.entity';
import { RfaRevision } from '../rfa/entities/rfa-revision.entity';
import {
  RFA_TYPE_CODE_GENERIC,
  RFA_STATUS_CODE_APPROVED,
  CORRESPONDENCE_STATUS_CLBOWN,
  CORRESPONDENCE_STATUS_DRAFT,
  IMPORT_TX_STATUS_SUCCESS,
  ENV_STAGING_DIR,
  STAGING_DIR_DEFAULT,
  ENV_LEGACY_NAS_PATH,
  LEGACY_NAS_PATH_DEFAULT,
} from './constants/migration.constants';

/**
 * ADR-016: โฟลเดอร์ staging ที่อนุญาตให้ stream ได้ — ใช้ env var
 * MIGRATION_STAGING_DIR (default: ./uploads/staging) ป้องกัน path traversal
 */
const STAGING_DIR_FALLBACK = path.join(process.cwd(), STAGING_DIR_DEFAULT);

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  private readonly stagingDir: string;
  private readonly legacyNasPath: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectRepository(ImportTransaction)
    private readonly importTransactionRepo: Repository<ImportTransaction>,
    @InjectRepository(CorrespondenceType)
    private readonly correspondenceTypeRepo: Repository<CorrespondenceType>,
    @InjectRepository(CorrespondenceStatus)
    private readonly correspondenceStatusRepo: Repository<CorrespondenceStatus>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(MigrationReviewQueue)
    private readonly reviewQueueRepo: Repository<MigrationReviewQueue>,
    @InjectRepository(MigrationError)
    private readonly errorRepo: Repository<MigrationError>,
    @InjectQueue('ai-batch')
    private readonly aiBatchQueue: Queue,
    private readonly fileStorageService: FileStorageService,
    private readonly ragBatchService: RagBatchService
  ) {
    this.stagingDir =
      this.configService.get<string>(ENV_STAGING_DIR) || STAGING_DIR_FALLBACK;
    this.legacyNasPath =
      this.configService.get<string>(ENV_LEGACY_NAS_PATH) ||
      LEGACY_NAS_PATH_DEFAULT;
  }

  async importCorrespondence(
    dto: ImportCorrespondenceDto,
    idempotencyKey: string,
    userId: number
  ) {
    if (!idempotencyKey) {
      throw new ValidationException('Idempotency-Key header is required');
    }

    // 1. Idempotency Check
    const existingTransaction = await this.importTransactionRepo.findOne({
      where: { idempotencyKey },
    });

    if (existingTransaction) {
      if (existingTransaction.statusCode === IMPORT_TX_STATUS_SUCCESS) {
        this.logger.log(
          `Idempotency key ${idempotencyKey} already processed. Returning cached success.`
        );
        return {
          message: 'Already processed',
          transaction: existingTransaction,
        };
      } else {
        throw new ConflictException(
          'MIGRATION_DUPLICATE_TRANSACTION',
          `Transaction failed previously with status ${existingTransaction.statusCode}`,
          'รายการนี้เคยดำเนินการไปแล้วและล้มเหลว',
          ['ตรวจสอบสถานะ Transaction ก่อนหน้า', 'ลองใช้ Idempotency-Key ใหม่']
        );
      }
    }

    // 2. Fetch Dependencies
    // Alias map: n8n AI categories → correspondence_types.type_code
    const CATEGORY_ALIAS: Record<string, string> = {
      Correspondence: 'LETTER',
      Letter: 'LETTER',
      Drawing: 'OTHER',
      Report: 'OTHER',
      Other: 'OTHER',
    };

    const type = await this.correspondenceTypeRepo.findOne({
      where: { typeName: dto.category },
    });

    // If exact name isn't found, try typeCode just in case
    let typeId = type
      ? type.id
      : (
          await this.correspondenceTypeRepo.findOne({
            where: { typeCode: dto.category },
          })
        )?.id;

    // Third-level fallback: resolve via alias map
    if (!typeId && dto.category && CATEGORY_ALIAS[dto.category]) {
      typeId = (
        await this.correspondenceTypeRepo.findOne({
          where: { typeCode: CATEGORY_ALIAS[dto.category] },
        })
      )?.id;
    }

    if (!typeId) {
      throw new ValidationException(
        `Category "${dto.category}" not found in system`
      );
    }

    // Default status for correspondence
    let status = await this.correspondenceStatusRepo.findOne({
      where: { statusCode: CORRESPONDENCE_STATUS_CLBOWN },
    });
    if (!status) {
      status = await this.correspondenceStatusRepo.findOne({
        where: { statusCode: CORRESPONDENCE_STATUS_DRAFT },
      });
    }
    if (!status) {
      throw new SystemException(
        'No default correspondence status found (missing CLBOWN/DRAFT)'
      );
    }

    // We now use project_id from n8n (instead of hardcoding LCBP3)
    const project = await this.projectRepo.findOne({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project', String(dto.projectId));
    }

    const isRFA = type?.typeCode === 'RFA' || dto.category === 'RFA';

    // ADR-019: resolve UUID publicId → internal INT id สำหรับ sender/receiver/discipline
    let resolvedSenderId = dto.senderId;
    if (!resolvedSenderId && dto.senderPublicId) {
      const senderOrg = await this.dataSource.manager.findOne(Organization, {
        where: { publicId: dto.senderPublicId },
        select: ['id'],
      });
      if (!senderOrg) {
        throw new NotFoundException('Sender organization', dto.senderPublicId);
      }
      resolvedSenderId = senderOrg.id;
    }

    let resolvedReceiverId = dto.receiverId;
    if (!resolvedReceiverId && dto.receiverPublicId) {
      const receiverOrg = await this.dataSource.manager.findOne(Organization, {
        where: { publicId: dto.receiverPublicId },
        select: ['id'],
      });
      if (!receiverOrg) {
        throw new NotFoundException(
          'Receiver organization',
          dto.receiverPublicId
        );
      }
      resolvedReceiverId = receiverOrg.id;
    }

    // Discipline ใช้ internal INT id โดยตรง (ADR-019 Excluded Tables: Master/Lookup)
    const resolvedDisciplineId = dto.disciplineId;
    if (resolvedDisciplineId) {
      const discipline = await this.dataSource.manager.findOne(Discipline, {
        where: { id: resolvedDisciplineId },
        select: ['id'],
      });
      if (!discipline) {
        throw new NotFoundException('Discipline', String(resolvedDisciplineId));
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. Find or Create Correspondence
      let correspondence = await queryRunner.manager.findOne(Correspondence, {
        where: {
          correspondenceNumber: dto.documentNumber,
          projectId: project.id,
        },
      });

      if (!correspondence) {
        correspondence = queryRunner.manager.create(Correspondence, {
          correspondenceNumber: dto.documentNumber,
          correspondenceTypeId: typeId,
          projectId: project.id,
          disciplineId: resolvedDisciplineId || undefined,
          originatorId: resolvedSenderId || undefined,
          isInternal: false,
          createdBy: userId,
        });
        await queryRunner.manager.save(correspondence);

        // สร้าง CorrespondenceRecipient (TO) สำหรับ receiver organization
        if (resolvedReceiverId) {
          const recipient = queryRunner.manager.create(
            CorrespondenceRecipient,
            {
              correspondenceId: correspondence.id,
              recipientOrganizationId: resolvedReceiverId,
              recipientType: 'TO' as const,
            }
          );
          await queryRunner.manager.save(CorrespondenceRecipient, recipient);
        }

        // --- CTI: insert RFA class ---
        if (isRFA) {
          // ADR-016: ห้าม fallback ค่า Master Data อัตโนมัติ — throw เพื่อ
          // ป้องกัน data corruption และบังคับให้ DBA ตรวจสอบ seed data
          const rfaTypeRes = await queryRunner.manager.query<{ id: number }[]>(
            'SELECT id FROM rfa_types WHERE type_code = ? LIMIT 1',
            [RFA_TYPE_CODE_GENERIC]
          );
          if (!rfaTypeRes[0]?.id) {
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
        // Update values if missing
        let hasChanges = false;
        if (resolvedDisciplineId && !correspondence.disciplineId) {
          correspondence.disciplineId = resolvedDisciplineId;
          hasChanges = true;
        }
        if (resolvedSenderId && !correspondence.originatorId) {
          correspondence.originatorId = resolvedSenderId;
          hasChanges = true;
        }
        if (hasChanges) {
          await queryRunner.manager.save(correspondence);
        }

        // เพิ่ม recipient ถ้ายังไม่มี (แยกตาม recipientType ด้วย TO)
        if (resolvedReceiverId) {
          const existingRecipient = await queryRunner.manager.findOne(
            CorrespondenceRecipient,
            {
              where: {
                correspondenceId: correspondence.id,
                recipientOrganizationId: resolvedReceiverId,
                recipientType: 'TO' as const,
              },
            }
          );
          if (!existingRecipient) {
            const recipient = queryRunner.manager.create(
              CorrespondenceRecipient,
              {
                correspondenceId: correspondence.id,
                recipientOrganizationId: resolvedReceiverId,
                recipientType: 'TO' as const,
              }
            );
            await queryRunner.manager.save(CorrespondenceRecipient, recipient);
          }
        }
      }

      // 4. File Handling — ถ้าไม่มีไฟล์ PDF ให้นำเข้าได้โดยไม่มี attachment
      // ADR-019: รองรับทั้ง tempAttachmentId (เดี่ยว, deprecated) และ tempAttachmentIds (หลายไฟล์)
      let attachmentId: number | null = null;
      const allAttachmentIds: number[] = [];
      if (dto.tempAttachmentIds && dto.tempAttachmentIds.length > 0) {
        allAttachmentIds.push(...dto.tempAttachmentIds);
      } else if (dto.tempAttachmentId) {
        allAttachmentIds.push(dto.tempAttachmentId);
      }

      if (allAttachmentIds.length > 0) {
        attachmentId = allAttachmentIds[0];
        try {
          // Mark attachments as permanent (ทุกไฟล์ใน array)
          await queryRunner.manager.update(
            Attachment,
            { id: In(allAttachmentIds) },
            { isTemporary: false }
          );
        } catch (fileError: unknown) {
          const errMsg =
            fileError instanceof Error ? fileError.message : String(fileError);
          this.logger.warn(
            `Failed to update temp_files [ids:${allAttachmentIds.join(',')}]: ${errMsg}`
          );
        }
      } else if (dto.sourceFilePaths && dto.sourceFilePaths.length > 0) {
        // ADR-047: import หลายไฟล์จาก sourceFilePaths
        for (const sfPath of dto.sourceFilePaths) {
          if (!sfPath || !sfPath.trim()) continue;
          try {
            const attachment = await this.fileStorageService.importStagingFile(
              sfPath,
              userId,
              { documentType: dto.category }
            );
            if (!attachmentId) attachmentId = attachment.id;
          } catch (fileError: unknown) {
            const errMsg =
              fileError instanceof Error
                ? fileError.message
                : String(fileError);
            this.logger.warn(
              `Failed to import file for [${dto.documentNumber}], continuing without attachment: ${errMsg}`
            );
          }
        }
      } else if (dto.sourceFilePath && dto.sourceFilePath.trim()) {
        try {
          const attachment = await this.fileStorageService.importStagingFile(
            dto.sourceFilePath,
            userId,
            { documentType: dto.category }
          );
          attachmentId = attachment.id;
        } catch (fileError: unknown) {
          const errMsg =
            fileError instanceof Error ? fileError.message : String(fileError);

          this.logger.warn(
            `Failed to import file for [${dto.documentNumber}], continuing without attachment: ${errMsg}`
          );
        }
      }

      // ADR-042/047: บันทึก OCR text ลง Attachment ก่อน commit เพื่อ RAG pipeline
      // บันทึกเฉพาะเมื่อมี ocrText — ถ้าไม่มี RAG จะทำ OCR เองจาก attachmentPath (D158)
      if (attachmentId && dto.ocrText?.trim()) {
        await queryRunner.manager.update(
          Attachment,
          { id: attachmentId },
          { ocrText: dto.ocrText.trim() }
        );
      }

      // Helper function to parse Date safety
      const parseDateStr = (d?: string | number) => {
        if (!d) return undefined;
        const num = Number(d);
        if (!isNaN(num) && num > 20000 && num < 100000) {
          return new Date(Math.round((num - 25569) * 86400 * 1000));
        }
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return undefined;
        if (parsed.getFullYear() > 2100 || parsed.getFullYear() < 1900)
          return undefined;
        return parsed;
      };

      // 5. Create or Update Revision
      // ADR-002: ป้องกัน revision race condition — ใช้ pessimistic lock ค้นหา
      // revision ปัจจุบันแทน count() ที่อ่าน snapshot แล้ว race กับ concurrent tx
      // Note: uq_master_current (correspondence_id, is_current) constraint บังคับ
      // ให้มีได้แค่ 1 row ต่อ (correspondence_id, is_current) pair ดังนั้น
      // ถ้า import ซ้ำให้ update revision ปัจจุบันแทนสร้างใหม่
      const currentRevisions = await queryRunner.manager.find(
        CorrespondenceRevision,
        {
          where: { correspondenceId: correspondence.id },
          lock: { mode: 'pessimistic_write' },
          order: { revisionNumber: 'DESC' },
        }
      );
      const revisionCount = currentRevisions.length;
      const existingCurrent = currentRevisions.find((r) => r.isCurrent);

      let revision: CorrespondenceRevision;
      if (existingCurrent) {
        // Update revision ปัจจุบันแทนการสร้างใหม่ (ป้องกัน uq_master_current conflict)
        existingCurrent.subject = dto.subject;
        // D159: body ใช้ AI summary (aiSummary) แทน OCR ดิบ (ocrText)
        // ลำดับความสำคัญ: reviewer body > AI summary > undefined
        existingCurrent.body = dto.body || dto.aiSummary || undefined;
        existingCurrent.documentDate = parseDateStr(
          dto.documentDate || dto.issuedDate
        );
        existingCurrent.receivedDate = parseDateStr(dto.receivedDate);
        existingCurrent.remarks = dto.remarks || undefined;
        existingCurrent.details = {
          ...dto.details,
          ai_confidence: dto.aiConfidence,
          ai_issues: dto.aiIssues as unknown,
          source_file_path: dto.sourceFilePath,
          attachment_id: attachmentId,
        };
        revision = existingCurrent;
        await queryRunner.manager.save(revision);
      } else {
        // ไม่มี current revision — สร้างใหม่
        const revNum =
          revisionCount > 0 ? (currentRevisions[0].revisionNumber ?? 0) + 1 : 0;
        revision = queryRunner.manager.create(CorrespondenceRevision, {
          correspondenceId: correspondence.id,
          revisionNumber: revNum,
          revisionLabel: revNum === 0 ? '0' : revNum.toString(),
          isCurrent: true,
          statusId: status.id,
          subject: dto.subject,
          description: 'Migrated from legacy system via Auto Ingest',
          // D159: body ใช้ AI summary (aiSummary) แทน OCR ดิบ (ocrText)
          // ลำดับความสำคัญ: reviewer body > AI summary > undefined
          body: dto.body || dto.aiSummary || undefined,
          // Mapping: excel issued_date → document_date (วันที่ออกเอกสาร)
          //          excel received_date → received_date (วันที่รับเอกสาร)
          documentDate: parseDateStr(dto.documentDate || dto.issuedDate),
          receivedDate: parseDateStr(dto.receivedDate),
          remarks: dto.remarks || undefined,
          details: {
            ...dto.details,
            ai_confidence: dto.aiConfidence,
            ai_issues: dto.aiIssues as unknown,
            source_file_path: dto.sourceFilePath,
            attachment_id: attachmentId,
          },
          schemaVersion: 1,
          createdBy: userId,
        });
        await queryRunner.manager.save(revision);
      }

      // --- CTI: insert RfaRevision ---
      if (isRFA) {
        // Migration: ค้นหา RFA status สำหรับ legacy import
        // ถ้าไม่พบ status_code 'APP' จะ fallback ไปยัง 'FCO' (For Construction)
        // และถ้ายังไม่พบอีก จะข้ามการสร้าง RfaRevision (log warning) เพื่อให้
        // import สำเร็จได้โดยไม่ block — DBA ควรเพิ่ม seed data ภายหลัง
        const rfaStatusRes = await queryRunner.manager.query<{ id: number }[]>(
          'SELECT id FROM rfa_status_codes WHERE status_code IN (?, ?) ORDER BY FIELD(status_code, ?, ?) LIMIT 1',
          [RFA_STATUS_CODE_APPROVED, 'FCO', RFA_STATUS_CODE_APPROVED, 'FCO']
        );
        if (!rfaStatusRes[0]?.id) {
          this.logger.warn(
            `RFA status codes not found ('${RFA_STATUS_CODE_APPROVED}' or 'FCO') — skipping RfaRevision creation for [${dto.documentNumber}]. DBA should add seed data to rfa_status_codes.`
          );
        } else {
          const rfaRev = queryRunner.manager.create(RfaRevision, {
            id: revision.id,
            rfaStatusCodeId: rfaStatusRes[0].id,
            details: {
              // Keep drawingCount as 0 for migration stub
              drawingCount: 0,
            },
            schemaVersion: 1,
          });
          await queryRunner.manager.save(RfaRevision, rfaRev);
        }
      }

      // 5.5 Handle Tags
      if (
        dto.details &&
        Array.isArray(dto.details.tags) &&
        dto.details.tags.length > 0
      ) {
        for (const tagItem of dto.details.tags) {
          let tagName: string | undefined;

          if (typeof tagItem === 'string') {
            tagName = tagItem;
          } else if (tagItem && typeof tagItem === 'object') {
            const tObj = tagItem as { tagName?: unknown };
            if (typeof tObj.tagName === 'string') {
              tagName = tObj.tagName;
            }
          }

          if (!tagName) continue;

          // Find or create Tag
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

          // Link to correspondence
          await queryRunner.manager.query(
            'INSERT IGNORE INTO correspondence_tags (correspondence_id, tag_id) VALUES (?, ?)',
            [correspondence.id, tagId]
          );
        }
      }
      // 6. Track Transaction
      const transaction = queryRunner.manager.create(ImportTransaction, {
        idempotencyKey,
        documentNumber: dto.documentNumber,
        batchId: dto.batchId,
        statusCode: IMPORT_TX_STATUS_SUCCESS,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      // ADR-042/047: trigger rag-prepare เส้นเดียวกับเอกสารปกติ หลัง commit
      // D158: trigger RAG เมื่อมี attachment เท่านั้น — ไม่ต้องมี ocrText
      // ถ้าไม่มี cachedOcrText, processRagPrepare จะอ่านจาก attachment หรือทำ OCR เอง
      if (attachmentId) {
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
              cachedOcrText: dto.ocrText?.trim() || undefined,
              attachmentPath: mainAttachment.filePath || undefined,
              attachmentPublicId: mainAttachment.publicId,
            });
          } catch (ragErr: unknown) {
            const ragMsg =
              ragErr instanceof Error ? ragErr.message : String(ragErr);
            this.logger.warn(
              `Post-import RAG re-embed failed for [${correspondence.publicId}]: ${ragMsg}`
            );
          }
        }
      }

      this.logger.log(
        `Ingested document [${dto.documentNumber}] successfully (Batch: ${dto.batchId})`
      );

      return {
        message: 'Import successful',
        correspondenceId: correspondence.id,
        revisionId: revision.id,
        transactionId: transaction.id,
        hasAttachment: attachmentId !== null,
      };
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Import failed for document [${dto.documentNumber}]: ${errorMessage}`,
        errorStack
      );

      const failedTransaction = this.importTransactionRepo.create({
        idempotencyKey,
        documentNumber: dto.documentNumber,
        batchId: dto.batchId,
        statusCode: 500,
      });
      await this.importTransactionRepo.save(failedTransaction).catch(() => {});

      throw new SystemException('Migration import failed: ' + errorMessage);
    } finally {
      await queryRunner.release();
    }
  }

  async enqueueRecord(dto: EnqueueMigrationDto) {
    if (!dto.documentNumber) {
      throw new ValidationException('documentNumber is required');
    }

    // Determine status based on confidence policy in ADR-017
    let autoStatus = MigrationReviewStatus.PENDING;
    if (
      dto.isValid === false ||
      (dto.confidence != null && dto.confidence < 0.6)
    ) {
      autoStatus = MigrationReviewStatus.REJECTED;
    }

    // Upsert or create new queue item
    let queueItem = await this.reviewQueueRepo.findOne({
      where: { documentNumber: dto.documentNumber },
    });

    if (!queueItem) {
      queueItem = this.reviewQueueRepo.create({
        documentNumber: dto.documentNumber,
        batchId: dto.batchId || 'unknown',
      });
    }

    queueItem.subject = dto.subject;
    queueItem.originalSubject = dto.originalSubject;
    queueItem.body = dto.body;
    queueItem.aiSuggestedCategory = dto.category;
    queueItem.aiIssues = dto.aiIssues;
    queueItem.projectId = dto.projectId;
    queueItem.senderOrganizationId = dto.senderOrgId;
    queueItem.receiverOrganizationId = dto.receiverOrgId;
    queueItem.remarks = dto.remarks;
    queueItem.aiSummary = dto.aiSummary;
    queueItem.extractedTags = dto.extractedTags;
    queueItem.tempAttachmentId = dto.tempAttachmentId;
    queueItem.status = autoStatus;
    queueItem.aiJobId = dto.aiJobId;

    // Feature 242: เพิ่ม multi-attachment และ compare fields
    if (dto.tempAttachmentIds && dto.tempAttachmentIds.length > 0) {
      queueItem.tempAttachmentIds = dto.tempAttachmentIds;
    } else if (dto.tempAttachmentId) {
      // R4: backward compatibility — แปลง tempAttachmentId เดี่ยวเป็น array
      queueItem.tempAttachmentIds = [dto.tempAttachmentId];
    }
    if (dto.compareStatus) {
      queueItem.compareStatus = dto.compareStatus;
    }
    queueItem.compareUnavailableReason = dto.compareUnavailableReason;

    if (dto.issuedDate) {
      const parsed = new Date(dto.issuedDate);
      if (!isNaN(parsed.getTime())) queueItem.issuedDate = parsed;
    }
    if (dto.receivedDate) {
      const parsed = new Date(dto.receivedDate);
      if (!isNaN(parsed.getTime())) queueItem.receivedDate = parsed;
    }

    await this.reviewQueueRepo.save(queueItem);

    this.logger.log(
      `Enqueued document [${dto.documentNumber}] to staging queue with status [${autoStatus}]`
    );

    return {
      message: 'Document enqueued successfully',
      id: queueItem.id,
      status: autoStatus,
    };
  }

  /**
   * อัปเดตผลลัพธ์จากการประมวลผล AI (OCR, Tags, Category, Confidence) ลงใน Staging Queue (ADR-047)
   * Edge Case 4: รองรับการ mark ai_failed เมื่อ BullMQ retry ครบแล้วยังไม่สำเร็จ
   */
  async updateQueueEnrichment(
    queueId: number,
    data: {
      ocrText?: string;
      aiSummary?: string;
      aiSuggestedCategory?: string;
      extractedTags?: Record<string, string>[];
      aiConfidence?: number;
      aiIssues?: Record<string, unknown>[];
      aiFailed?: boolean;
      aiStatus?: MigrationAiStatus;
      status?: MigrationReviewStatus;
    }
  ) {
    const queueItem = await this.reviewQueueRepo.findOne({
      where: { id: queueId },
    });
    if (queueItem) {
      if (data.ocrText !== undefined) queueItem.ocrText = data.ocrText;
      if (data.aiSummary !== undefined) queueItem.aiSummary = data.aiSummary;
      if (data.aiSuggestedCategory !== undefined)
        queueItem.aiSuggestedCategory = data.aiSuggestedCategory;
      if (data.extractedTags !== undefined)
        queueItem.extractedTags = data.extractedTags;
      if (data.aiConfidence !== undefined)
        queueItem.aiConfidence = data.aiConfidence;
      if (data.aiIssues !== undefined) queueItem.aiIssues = data.aiIssues;
      if (data.aiFailed !== undefined) queueItem.aiFailed = data.aiFailed;
      if (data.aiStatus !== undefined) queueItem.aiStatus = data.aiStatus;
      if (data.status !== undefined) queueItem.status = data.status;
      await this.reviewQueueRepo.save(queueItem);
    }
  }

  /**
   * ADR-047: เริ่มประมวลผล OCR/AI ของ queue item เดียว โดย enqueue legacy-ai-enrichment job
   */
  async startExtractQueueItem(
    publicId: string,
    idempotencyKey: string,
    userId: number
  ) {
    const queueItem = await this.getQueueItemByPublicId(publicId);
    if (queueItem.status !== MigrationReviewStatus.PENDING) {
      throw new ConflictException(
        'MIGRATION_INVALID_STATE',
        `Queue item ${publicId} is ${queueItem.status}`,
        'รายการนี้ไม่อยู่ในสถานะทีสามารถเริ่มประมวลผลได้'
      );
    }
    // ป้องกัน duplicate BullMQ job: ถ้ามี aiJobId อยู่แล้วและไม่ใช่ FAILED
    // ให้ skip (รวมกรณี aiStatus เป็น NULL ซึ่งเกิดจาก ingestion ที่ไม่ได้ set aiStatus)
    // FAILED เป็นกรณีพิเศษที่อนุญาตให้ retry ได้
    if (
      queueItem.aiStatus === MigrationAiStatus.RUNNING ||
      (queueItem.aiJobId != null &&
        queueItem.aiStatus !== MigrationAiStatus.FAILED)
    ) {
      return {
        message: 'AI extraction already running or queued',
        jobId: queueItem.aiJobId,
      };
    }

    // หา source PDF path จาก details (resolvedPdfPath จาก LegacyIngestionService เป็น absolute path)
    const details = queueItem.details ?? {};
    const pdfPath =
      typeof details.source_file_path === 'string'
        ? details.source_file_path
        : undefined;

    const job = await this.aiBatchQueue.add(
      'legacy-ai-enrichment',
      {
        // Job metadata สำหรับ AiBatchProcessor แยกประเภทงาน (ADR-047 bugfix)
        jobType: 'legacy-ai-enrichment',
        documentPublicId: queueItem.publicId,
        // Payload สำหรับ processLegacyAiEnrichment
        queueId: queueItem.id,
        queuePublicId: queueItem.publicId,
        documentNumber: queueItem.documentNumber,
        pdfPath: pdfPath,
        projectPublicId: queueItem.projectId
          ? ((
              await this.projectRepo.findOne({
                where: { id: queueItem.projectId },
              })
            )?.publicId ?? '00000000-0000-0000-0000-000000000000')
          : '00000000-0000-0000-0000-000000000000',
        projectId: queueItem.projectId,
      },
      {
        jobId: `legacy-enrich-${queueItem.publicId}-${idempotencyKey}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      }
    );

    queueItem.aiStatus = MigrationAiStatus.PENDING;
    queueItem.aiJobId = String(job.id);
    await this.reviewQueueRepo.save(queueItem);

    this.logger.log(
      `User ${userId} started AI extraction for queue ${publicId}, jobId ${String(job.id)}`
    );
    return {
      message: 'AI extraction started',
      jobId: String(job.id),
    };
  }

  /**
   * ADR-047: เริ่มประมวลผล OCR/AI แบบ batch
   */
  async startExtractBatch(
    publicIds: string[],
    idempotencyKey: string,
    userId: number
  ) {
    const results = [];
    for (let i = 0; i < publicIds.length; i++) {
      try {
        const subKey = `${idempotencyKey}-${i}`;
        const result = await this.startExtractQueueItem(
          publicIds[i],
          subKey,
          userId
        );
        results.push({ publicId: publicIds[i], ...result });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ publicId: publicIds[i], error: msg });
      }
    }
    return { results };
  }

  async getReviewQueue(query: MigrationQueueQueryDto) {
    const { page = 1, limit = 10, status, aiStatus, batchId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.reviewQueueRepo.createQueryBuilder('queue');
    if (status) {
      queryBuilder.where('queue.status = :status', { status });
    }
    if (aiStatus) {
      queryBuilder.andWhere('queue.aiStatus = :aiStatus', { aiStatus });
    }
    if (batchId) {
      queryBuilder.andWhere('queue.batch_id = :batchId', { batchId });
    }

    queryBuilder.orderBy('queue.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    // Feature 242: enrich items with attachments[] metadata (FR-005)
    let enrichedItems = await this.enrichWithAttachments(items);

    // Enrich ชื่อ organization_code และชื่อประเภทเอกสารเพื่อแสดงผลในหน้า Legacy Management
    enrichedItems = await this.enrichWithReferenceData(enrichedItems);

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * เพิ่มข้อมูล attachments[] ให้แต่ละ queue item (FR-005)
   * คืนรายการพร้อม publicId, originalFilename, mimeType, hasOcrText, isMainDocument
   */
  private async enrichWithAttachments(
    items: MigrationReviewQueue[]
  ): Promise<MigrationReviewQueue[]> {
    // รวบรวม attachment IDs ทั้งหมดจากทุก item
    const allAttachmentIds: number[] = [];
    const itemAttachmentMap = new Map<number, number[]>();
    for (const item of items) {
      const ids: number[] = [];
      if (item.tempAttachmentIds && item.tempAttachmentIds.length > 0) {
        ids.push(...item.tempAttachmentIds);
      } else if (item.tempAttachmentId) {
        ids.push(item.tempAttachmentId);
      }
      itemAttachmentMap.set(item.id, ids);
      allAttachmentIds.push(...ids);
    }
    if (allAttachmentIds.length === 0) return items;
    // ดึง attachment metadata ทั้งหมดในครั้งเดียว
    const attachments = await this.dataSource.manager.find(Attachment, {
      where: { id: In(allAttachmentIds) },
      select: ['id', 'publicId', 'originalFilename', 'mimeType', 'ocrText'],
    });
    const attachmentMap = new Map(attachments.map((a) => [a.id, a]));
    // แนบ attachments[] ให้แต่ละ item ผ่าน details field
    for (const item of items) {
      const ids = itemAttachmentMap.get(item.id) ?? [];
      const itemAttachments = ids
        .map((id, index) => {
          const att = attachmentMap.get(id);
          if (!att) return null;
          return {
            publicId: att.publicId,
            originalFilename: att.originalFilename,
            mimeType: att.mimeType,
            hasOcrText: !!(att.ocrText && att.ocrText.length > 0),
            isMainDocument: index === 0,
          };
        })
        .filter(Boolean);
      // เก็บใน details เพื่อให้ serialize ออก API ได้
      if (!item.details) {
        (
          item as MigrationReviewQueue & { details: Record<string, unknown> }
        ).details = {};
      }
      (item.details as Record<string, unknown>)['attachments'] =
        itemAttachments;
    }
    return items;
  }

  /**
   * เพิ่มข้อมูลอ้างอิง organization_code (ผู้ส่ง/ผู้รับ) และชื่อประเภทเอกสาร
   * เพื่อแสดงผลในหน้า Legacy Management โดยไม่ต้อง query ทีละรายการ
   */
  private async enrichWithReferenceData(
    items: MigrationReviewQueue[]
  ): Promise<MigrationReviewQueue[]> {
    const orgIds = new Set<number>();
    const typeCodes = new Set<string>();
    for (const item of items) {
      if (item.senderOrganizationId) orgIds.add(item.senderOrganizationId);
      if (item.receiverOrganizationId) orgIds.add(item.receiverOrganizationId);
      if (item.aiSuggestedCategory) typeCodes.add(item.aiSuggestedCategory);
    }

    const orgMap = new Map<number, { code: string; publicId: string }>();
    const typeMap = new Map<string, { typeName: string; typeCode: string }>();

    if (orgIds.size > 0) {
      const orgs = await this.dataSource.manager.find(Organization, {
        where: { id: In(Array.from(orgIds)) },
        select: ['id', 'organizationCode', 'publicId'],
      });
      for (const org of orgs) {
        orgMap.set(org.id, {
          code: org.organizationCode,
          publicId: org.publicId,
        });
      }
    }

    if (typeCodes.size > 0) {
      const types = await this.correspondenceTypeRepo.find({
        where: { typeCode: In(Array.from(typeCodes)) },
      });
      for (const ct of types) {
        typeMap.set(ct.typeCode, {
          typeName: ct.typeName,
          typeCode: ct.typeCode,
        });
      }
    }

    for (const item of items) {
      const senderOrg = orgMap.get(item.senderOrganizationId ?? -1);
      const receiverOrg = orgMap.get(item.receiverOrganizationId ?? -1);
      item.senderOrganizationCode = senderOrg?.code ?? null;
      item.receiverOrganizationCode = receiverOrg?.code ?? null;
      item.senderOrganizationPublicId = senderOrg?.publicId ?? null;
      item.receiverOrganizationPublicId = receiverOrg?.publicId ?? null;
      item.aiSuggestedCategoryName =
        typeMap.get(item.aiSuggestedCategory ?? '')?.typeName ??
        item.aiSuggestedCategory ??
        null;
    }
    return items;
  }

  async getQueueItemById(id: number) {
    const item = await this.reviewQueueRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Queue item', String(id));
    }
    // Feature 242: enrich single item with attachments[] (FR-005)
    const enriched = await this.enrichWithAttachments([item]);
    return enriched[0];
  }

  /**
   * ADR-019: ค้นหา queue item ด้วย publicId (UUIDv7) แทน INT PK
   * ใช้สำหรับ public API endpoints เพื่อไม่ leak internal row id
   */
  async getQueueItemByPublicId(publicId: string) {
    const item = await this.reviewQueueRepo.findOne({
      where: { publicId },
    });
    if (!item) {
      throw new NotFoundException('Queue item', publicId);
    }
    let enriched = await this.enrichWithAttachments([item]);
    enriched = await this.enrichWithReferenceData(enriched);
    return enriched[0];
  }

  async createError(dto: CreateMigrationErrorDto) {
    const error = this.errorRepo.create({
      batchId: dto.batchId,
      documentNumber: dto.documentNumber,
      errorType: dto.errorType,
      errorMessage: dto.errorMessage,
      rawAiResponse: dto.rawAiResponse,
    });
    const saved = await this.errorRepo.save(error);
    this.logger.warn(
      `Migration error logged [${dto.errorType}] for doc [${dto.documentNumber}] batch [${dto.batchId}]`
    );
    return { message: 'Error logged', id: saved.id };
  }

  async getErrors(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.errorRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * ลบรายการใน Review Queue ตาม batchId / ทั้งหมด / รายการที่เลือก
   * ADR-047: bulk delete สำหรับ Legacy Management พร้อมลบ BullMQ job
   */
  async deleteReviewQueueByBatch(
    batchId?: string,
    all: boolean = false,
    publicIds?: string[]
  ): Promise<{ deleted: number }> {
    let conditions: FindOptionsWhere<MigrationReviewQueue> = {};

    if (publicIds && publicIds.length > 0) {
      conditions = { publicId: In(publicIds) };
    } else if (!all) {
      if (!batchId) {
        throw new ValidationException(
          'ต้องระบุ batchId หรือ all=true หรือ publicIds'
        );
      }
      conditions = { batchId };
    }

    // ดึง ai_job_id ก่อนลบ เพื่อ remove จาก BullMQ ai-batch ด้วย
    const itemsToDelete = await this.reviewQueueRepo.find({
      where: conditions,
      select: ['aiJobId'],
    });
    const jobIds = itemsToDelete
      .map((item) => item.aiJobId)
      .filter((id): id is string => !!id);

    if (jobIds.length > 0) {
      try {
        await Promise.all(
          jobIds.map((jobId) => this.aiBatchQueue.remove(jobId))
        );
        this.logger.log(
          `Removed ${jobIds.length} legacy-ai-enrichment jobs from ai-batch queue`
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to remove some BullMQ jobs during queue delete: ${errMsg}`
        );
      }
    }

    const result = await this.reviewQueueRepo.delete(conditions);
    const deleted = result.affected ?? 0;
    this.logger.log(
      `Deleted ${deleted} review queue items (batchId=${batchId ?? 'ALL'}, selected=${publicIds?.length ?? 0})`
    );
    return { deleted };
  }

  /**
   * ลบรายการใน Migration Errors ตาม batchId หรือทั้งหมด
   * ADR-047: bulk delete สำหรับ Legacy Management
   */
  async deleteErrorsByBatch(
    batchId?: string,
    all: boolean = false
  ): Promise<{ deleted: number }> {
    // TypeORM delete() รับ FindOptionsWhere ที่ใช้ entity property names
    // บังคับใช้ primary key (id >= 0) เพื่อคู่กับ SQL_SAFE_UPDATES
    const conditions: FindOptionsWhere<MigrationError> = {
      id: MoreThanOrEqual(0),
    };
    if (!all) {
      if (!batchId) {
        throw new ValidationException('ต้องระบุ batchId หรือ all=true');
      }
      conditions.batchId = batchId;
    }
    const result = await this.errorRepo.delete(conditions);
    const deleted = result.affected ?? 0;
    this.logger.log(
      `Deleted ${deleted} migration errors (batchId=${batchId ?? 'ALL'})`
    );
    return { deleted };
  }

  /**
   * ดึงรายการ batchId ที่ไม่ซ้ำจาก Review Queue (สำหรับ filter dropdown)
   */
  async getQueueBatches(): Promise<string[]> {
    const result = await this.reviewQueueRepo
      .createQueryBuilder('queue')
      .select('DISTINCT queue.batch_id', 'batchId')
      .where('queue.batch_id IS NOT NULL')
      .orderBy('queue.batch_id', 'DESC')
      .getRawMany<{ batchId: string }>();
    return result.map((r) => r.batchId).filter(Boolean);
  }

  /**
   * ดึงรายการ batchId ที่ไม่ซ้ำจาก Migration Errors (สำหรับ filter dropdown)
   */
  async getErrorBatches(): Promise<string[]> {
    const result = await this.errorRepo
      .createQueryBuilder('error')
      .select('DISTINCT error.batch_id', 'batchId')
      .where('error.batch_id IS NOT NULL')
      .orderBy('error.batch_id', 'DESC')
      .getRawMany<{ batchId: string }>();
    return result.map((r) => r.batchId).filter(Boolean);
  }

  async approveQueueItem(
    id: number,
    dto: ImportCorrespondenceDto,
    idempotencyKey: string,
    userId: number
  ) {
    const queueItem = await this.reviewQueueRepo.findOne({ where: { id } });
    if (!queueItem) {
      throw new NotFoundException('Queue item', String(id));
    }

    if (queueItem.status !== MigrationReviewStatus.PENDING_REVIEW) {
      throw new BusinessException(
        'MIGRATION_ITEM_NOT_REVIEWABLE',
        `Queue item ${id} is ${queueItem.status}`,
        'รายการนี้ต้องอยู่ในสถานะ PENDING_REVIEW ก่อน Execute Import'
      );
    }

    // Attempt the import
    const importDto = {
      ...dto,
      ocrText: dto.ocrText ?? queueItem.ocrText ?? undefined,
      // D159: aiSummary fallback จาก queueItem (AI สรุปหลัง OCR extract) → revision.body
      aiSummary: dto.aiSummary ?? queueItem.aiSummary ?? undefined,
      // remarks: ใช้จาก dto ก่อน ถ้าไม่มีให้ fallback จาก queueItem (Excel import)
      remarks: dto.remarks ?? queueItem.remarks ?? undefined,
      // ADR-019: tempAttachmentId/tempAttachmentIds เป็น @Exclude ใน entity
      // ทำให้ frontend ไม่สามารถส่งค่านี้ได้ — ต้องดึงจาก queueItem โดยตรง
      tempAttachmentId:
        dto.tempAttachmentId ?? queueItem.tempAttachmentId ?? undefined,
      tempAttachmentIds:
        dto.tempAttachmentIds ?? queueItem.tempAttachmentIds ?? undefined,
    };
    const result = await this.importCorrespondence(
      importDto,
      idempotencyKey,
      userId
    );

    // If successful, update the queue item status
    queueItem.status = MigrationReviewStatus.IMPORTED;
    queueItem.reviewedBy = userId.toString();
    queueItem.reviewedAt = new Date();
    await this.reviewQueueRepo.save(queueItem);

    return result;
  }

  /**
   * ADR-019: approve queue item ด้วย publicId (UUIDv7) แทน INT PK
   */
  async approveQueueItemByPublicId(
    publicId: string,
    dto: ImportCorrespondenceDto,
    idempotencyKey: string,
    userId: number
  ) {
    const queueItem = await this.reviewQueueRepo.findOne({
      where: { publicId },
    });
    if (!queueItem) {
      throw new NotFoundException('Queue item', publicId);
    }

    if (queueItem.status !== MigrationReviewStatus.PENDING_REVIEW) {
      throw new BusinessException(
        'MIGRATION_ITEM_NOT_REVIEWABLE',
        `Queue item ${publicId} is ${queueItem.status}`,
        'รายการนี้ต้องอยู่ในสถานะ PENDING_REVIEW ก่อน Execute Import'
      );
    }

    const importDto = {
      ...dto,
      ocrText: dto.ocrText ?? queueItem.ocrText ?? undefined,
      // D159: aiSummary fallback จาก queueItem (AI สรุปหลัง OCR extract) → revision.body
      aiSummary: dto.aiSummary ?? queueItem.aiSummary ?? undefined,
      // remarks: ใช้จาก dto ก่อน ถ้าไม่มีให้ fallback จาก queueItem (Excel import)
      remarks: dto.remarks ?? queueItem.remarks ?? undefined,
      // ADR-019: tempAttachmentId/tempAttachmentIds เป็น @Exclude ใน entity
      // ทำให้ frontend ไม่สามารถส่งค่านี้ได้ — ต้องดึงจาก queueItem โดยตรง
      tempAttachmentId:
        dto.tempAttachmentId ?? queueItem.tempAttachmentId ?? undefined,
      tempAttachmentIds:
        dto.tempAttachmentIds ?? queueItem.tempAttachmentIds ?? undefined,
    };
    const result = await this.importCorrespondence(
      importDto,
      idempotencyKey,
      userId
    );

    queueItem.status = MigrationReviewStatus.IMPORTED;
    queueItem.reviewedBy = userId.toString();
    queueItem.reviewedAt = new Date();
    await this.reviewQueueRepo.save(queueItem);

    return result;
  }

  async commitBatch(
    dto: CommitBatchDto,
    idempotencyKey: string,
    userId: number
  ) {
    if (!idempotencyKey) {
      throw new ValidationException('Idempotency-Key header is required');
    }

    const results = [];
    const errors = [];

    // We let each import have its own transaction via approveQueueItemByPublicId
    // to avoid one bad record failing the entire batch of valid ones.

    for (const item of dto.items) {
      // Create a unique sub-key for each item to avoid idempotency conflicts
      // when using a batch idempotency key. (ADR-019: use publicId in sub-key)
      const subKey = `${idempotencyKey}_${item.queuePublicId}`;

      // Force batchId on the item dto
      item.dto.batchId = dto.batchId;

      try {
        const result = await this.approveQueueItemByPublicId(
          item.queuePublicId,
          item.dto,
          subKey,
          userId
        );
        results.push({ queuePublicId: item.queuePublicId, result });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({ queuePublicId: item.queuePublicId, error: errorMessage });
        this.logger.error(
          `Batch commit failed for queue publicId ${item.queuePublicId}: ${errorMessage}`
        );
      }
    }

    return {
      message: 'Batch processing completed',
      batchId: dto.batchId,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }

  async rejectQueueItem(id: number, userId: number) {
    const queueItem = await this.reviewQueueRepo.findOne({ where: { id } });
    if (!queueItem) {
      throw new NotFoundException('Queue item', String(id));
    }

    queueItem.status = MigrationReviewStatus.REJECTED;
    queueItem.reviewedBy = userId.toString();
    queueItem.reviewedAt = new Date();
    await this.reviewQueueRepo.save(queueItem);

    return {
      message: 'Document rejected successfully',
      id: queueItem.id,
    };
  }

  /**
   * ADR-019: reject queue item ด้วย publicId (UUIDv7) แทน INT PK
   */
  async rejectQueueItemByPublicId(publicId: string, userId: number) {
    const queueItem = await this.reviewQueueRepo.findOne({
      where: { publicId },
    });
    if (!queueItem) {
      throw new NotFoundException('Queue item', publicId);
    }

    queueItem.status = MigrationReviewStatus.REJECTED;
    queueItem.reviewedBy = userId.toString();
    queueItem.reviewedAt = new Date();
    await this.reviewQueueRepo.save(queueItem);

    return {
      message: 'Document rejected successfully',
      publicId: queueItem.publicId,
    };
  }

  /**
   * ADR-016: Stream ไฟล์จาก staging directory โดยตรวจ path traversal เข้มงวด
   * อนุญาตเฉพาะ path ที่ resolve แล้วอยู่ภายใต้ stagingDir เท่านั้น
   * ป้องกัน Local File Inclusion (LFI) เช่น `?path=../../etc/passwd`
   */
  getStagingFileStream(filePath: string) {
    if (!filePath) {
      throw new ValidationException('File path is required');
    }

    const resolvedPath = path.resolve(filePath);
    // ADR-016: Path Traversal Guard — อนุญาตเฉพาะ path ที่ resolve แล้วอยู่ภายใต้
    // stagingDir หรือ LEGACY_NAS_PATH (เพิ่มเพื่อรองรับไฟล์ PDF บน NAS mount — D157)
    const allowedRoots = [
      path.resolve(this.stagingDir),
      path.resolve(this.legacyNasPath),
    ];

    const isWithinAllowed = allowedRoots.some(
      (root) =>
        resolvedPath === root || resolvedPath.startsWith(root + path.sep)
    );

    if (!isWithinAllowed) {
      this.logger.warn(
        `Path traversal blocked: "${filePath}" resolves outside allowed dirs [${allowedRoots.join(', ')}]`
      );
      throw new ValidationException(
        'Invalid staging file path — access denied (path traversal guard)'
      );
    }

    if (!existsSync(resolvedPath)) {
      throw new NotFoundException('File', filePath);
    }

    return createReadStream(resolvedPath);
  }
}
