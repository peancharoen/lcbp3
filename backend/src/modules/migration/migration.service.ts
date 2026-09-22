// File: backend/src/modules/migration/migration.service.ts
// Change Log:
// - 2026-09-22: getStagingFileStream — bare filename (ไม่มี directory component)
//   ไม่ถือเป็น traversal อีกต่อไป ให้ไหลเข้า D330 recursive search โดยตรง
//   (เดิม resolve ไป cwd → โดน guard block ก่อนถึง fallback เสมอ)
// - 2026-09-17: ADR-054 — ส่ง register snapshot เข้า legacy extraction และ persist compare state ใหม่
// - 2026-09-16: เพิ่ม replaceQueueItemFile (PATCH /migration/queue/:publicId/file) —
//   เปลี่ยนไฟล์ต้นฉบับจาก staging/Legacy NAS (path-traversal guarded, find-or-create
//   attachment) หรือ attachment จาก /files/upload + audit ใน reviewState.fileReplacements
//   + auto re-extract กัน commit ข้อมูล AI ค้างจากไฟล์เก่า
// - 2026-08-23: ใช้ disciplineId (INT) โดยตรง, แก้ recipient lookup ให้แยก recipientType: TO
// - 2026-08-22: Persist IMPORTED after approve-and-import to match the database enum
// - 2026-08-30: เพิ่ม reExtractQueueItem สำหรับ re-extract ก่อน Execute Import
// - 2026-08-22: เพิ่ม startExtractQueueItem / startExtractBatch และปรับ execute import flow ตาม ADR-047
// - 2026-08-23: Execute Import บันทึก ocrText ลง Attachment/Revision และใช้ rag-prepare pipeline เดียวกับเอกสารปกติ
// - 2026-08-25: นำ remarks จาก Excel → correspondence_revisions.remarks (approve fallback จาก queueItem)
// - 2026-08-25: เพิ่ม LEGACY_NAS_PATH ใน getStagingFileStream allowed roots (D157)
// - 2026-08-25: RAG trigger ไม่ต้องมี ocrText — processRagPrepare ทำ OCR เองได้ (D158)
// - 2026-08-25: revision.body ใช้ aiSummary (AI สรุป) แทน ocrText (OCR ดิบ) — D159
// - 2026-08-31: ADR-050 — ลบ CATEGORY_ALIAS hardcode map, เพิ่ม getAllowedCategoryCodes()
//   (source of truth = correspondence_types.typeCode), เพิ่ม deterministic requiresHumanReview
//   computation ใน updateQueueEnrichment (ไม่เชื่อค่าที่ LLM ส่งมา), promote ocrQualityConfidence/
//   requiresHumanReview columns, backward-compat ai_confidence alias = min(metadata.confidence.*),
//   legacy-shape detection (FR-011) + server-side review-mode fetch guard (getQueueItemByPublicId)
// - 2026-08-26: Bugfix — ส่ง queryRunner.manager เข้า importStagingFile เพื่อให้ attachment
//   ถูกสร้างใน transaction เดียวกัน (ป้องกัน MariaDB error 1020 "Record has changed
//   since last read in table 'attachments'") และเพิ่ม INSERT ลง
//   correspondence_revision_attachments junction table (แก้ "No attachments found")
// - 2026-08-26: Bugfix — deleteReviewQueueByBatch เพิ่ม id: MoreThanOrEqual(0) เมื่อ all=true
// - 2026-08-26: Bugfix — ส่ง issueDate (จาก dto.documentDate) เข้า importStagingFile
//   เพื่อให้ folder permanent/{docType}/{YYYY}/{MM}/ ใช้วันที่เอกสาร ไม่ใช่วันที่นำเข้า
//   (TypeORM ปฏิเสธ delete({}) ด้วย empty conditions) + aiStatus เริ่มต้นเป็น WAITING แทน PENDING
// - 2026-09-13: Feature 254 — route migration post-import ผ่าน RagAttachmentIngestProcessor
//   แทน deprecated EmbeddingService: compute SHA-256 checksum ตอน import + ingest() + enqueueRagAttachmentIngestion
//   สร้าง rag_attachment_generations/chunks records + อัปเดต rag_status (ADR-022)
// - 2026-09-13: Fix — IMPORT_TX_STATUS_FAILED constant แทน hardcoded 500
// - 2026-09-14: ADR-054 T006 (FR-014) — enqueueRecord persist dto.details เข้า ai_metadata_json
//   (merge กับค่าเดิม) แทนการ drop ทั้งก้อน — compareResult/capturedThresholds/disciplineId
//   จาก processMigrateDocument ถึงได้บันทึกจริง
// - 2026-09-14: ADR-054 US1 (T010-T015) — re-extract ปลอดภัยจาก data loss:
//   T010 resolveQueuePdfPath (storageTempPath → attachments.file_path fallback ผ่าน
//   tempAttachmentIds[0] แทน details.source_file_path); T011 snapshot ocrText→ocrTextBak
//   ใน updateQueueEnrichment (ข้าม placeholder ตาม isOcrFailurePlaceholder);
//   T012 reExtractQueueItem snapshot + whitelist details + reset requiresHumanReview/
//   ocrQualityConfidence/reviewReason; T014 restoreOcrText (MIGRATION_NO_BACKUP);
//   reviewer hardening — enqueueRecord whitelist dto.details keys
//   (ALLOWED_ENQUEUE_DETAILS_KEYS)
// - 2026-09-14: ADR-054 US2 reviewer folds — startExtractQueueItem strip transient
//   `attachments[]` ออกจาก details ก่อน save (กัน enrichWithAttachments หลุด persist
//   ลง ai_metadata_json); getReviewQueue list ตัด ocrTextBak ออก expose
//   `hasOcrTextBak` flag แทน; แก้ docblock resolveQueuePdfPath ให้ตรงจริง (filename-only
//   ถูก resolve โดย getStagingFileStream D330 ไม่ใช่ตอน extract)
// - 2026-09-14: ADR-054 US3 (T026a-b, FR-008) — importCorrespondence คืน
//   correspondencePublicId (success + idempotent replay resolve จาก
//   document_number+project_id); approveQueueItem/approveQueueItemByPublicId
//   ตั้ง importedCorrespondencePublicId เป็น audit link และ retain queue row
// - 2026-09-15: ADR-054 review-fold fixes — restoreOcrText swap semantics (current
//   real text เข้า bak แทนถูกเขียนทับ); re-extract reset compareStatus→UNAVAILABLE
//   (column NOT NULL + badge ต้องไม่โชว์ COMPARED ขณะ data ถูกล้าง); reviewedBy
//   varchar→int ตาม schema จริง; detail paths expose hasOcrTextBak; replay miss warn;
//   whitelist trim compareStatus/compareUnavailableReason (มี column แล้ว)

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
  CompareStatus,
} from './entities/migration-review-queue.entity';
import { MigrationError } from './entities/migration-error.entity';
import { MigrationQueueQueryDto } from './dto/migration-queue-query.dto';
import { ReplaceQueueFileDto } from './dto/replace-queue-file.dto';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { createReadStream, existsSync, readdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import * as path from 'path';
import { v7 as uuidv7 } from 'uuid';
import { RagBatchService } from './services/rag-batch.service';
import { ReviewThresholdService } from './services/review-threshold.service';
import { RagAttachmentIngestionService } from '../ai/services/rag-attachment-ingestion.service';
import { AiQueueService } from '../ai/ai-queue.service';
import type {
  MigrationAiExtractionDetails,
  MetadataConfidence,
  MigrationFileReplacement,
} from './types/ai-extraction-details.type';
import { Rfa } from '../rfa/entities/rfa.entity';
import { RfaRevision } from '../rfa/entities/rfa-revision.entity';
import { linkAttachmentsToRevision } from './utils/attachment-linking.util';
import {
  RFA_TYPE_CODE_GENERIC,
  RFA_STATUS_CODE_APPROVED,
  CORRESPONDENCE_STATUS_CLBOWN,
  CORRESPONDENCE_STATUS_DRAFT,
  IMPORT_TX_STATUS_SUCCESS,
  IMPORT_TX_STATUS_FAILED,
  ENV_STAGING_DIR,
  STAGING_DIR_DEFAULT,
  ENV_LEGACY_NAS_PATH,
  LEGACY_NAS_PATH_DEFAULT,
  isOcrFailurePlaceholder,
} from './constants/migration.constants';

/**
 * ADR-016: โฟลเดอร์ staging ที่อนุญาตให้ stream ได้ — ใช้ env var
 * MIGRATION_STAGING_DIR (default: ./uploads/staging) ป้องกัน path traversal
 */
const STAGING_DIR_FALLBACK = path.join(process.cwd(), STAGING_DIR_DEFAULT);

/**
 * ADR-054 reviewer hardening — keys ของ `dto.details` ที่ `enqueueRecord` ยอมรับเข้า
 * `ai_metadata_json` เท่านั้น (ตรงกับสิ่งที่ `processMigrateDocument` ส่งจริง)
 * กัน caller ที่ authorized ฉีด `source_file_path`/`fieldResolutions`/key อื่นๆ เข้า
 * bag ที่ถูก narrow แล้ว (AI output + residual ingestion keys เท่านั้น)
 * หมายเหตุ: disciplineCode/disciplineId/recipientsList เป็น compare/ingestion metadata
 * จาก processMigrateDocument (ไม่ใช่ AI output ตาม FR-010) — เก็บใน details เพราะยังไม่มี
 * column เฉพาะ; compareStatus/compareUnavailableReason มี dedicated columns แล้ว
 * (map จาก flat dto fields) จึงไม่ duplicate ลง details
 */
const ALLOWED_ENQUEUE_DETAILS_KEYS: readonly string[] = [
  'disciplineCode',
  'disciplineId',
  'recipientsList',
  'compareResult',
  'capturedThresholds',
];

/**
 * ADR-054 D3/D9 (FR-005) — residual ingestion keys ที่ re-extract ต้อง preserve ใน
 * `details` (ไม่มี dedicated column) — key อื่นทั้งหมดถือเป็น AI output ถูกล้าง
 */
const REEXTRACT_PRESERVED_DETAILS_KEYS: readonly string[] = [
  'original_row_index',
  'unresolved_orgs',
  'original_document_number',
  'revision_number',
];

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
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectQueue('ai-batch')
    private readonly aiBatchQueue: Queue,
    private readonly fileStorageService: FileStorageService,
    private readonly ragBatchService: RagBatchService,
    private readonly reviewThresholdService: ReviewThresholdService,
    private readonly ragIngestionService: RagAttachmentIngestionService,
    private readonly aiQueueService: AiQueueService
  ) {
    this.stagingDir =
      this.configService.get<string>(ENV_STAGING_DIR) || STAGING_DIR_FALLBACK;
    this.legacyNasPath =
      this.configService.get<string>(ENV_LEGACY_NAS_PATH) ||
      LEGACY_NAS_PATH_DEFAULT;
  }

  // ADR-054 US3 (T026a, FR-008): ทุก branch ของ return ต้องมี correspondencePublicId
  // (optional) — durable audit link → correspondences.uuid (UUIDv7 string, ADR-019)
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
        // ADR-054 US3 (T026a, FR-008): idempotent replay — resolve correspondence
        // ที่เคยสร้างไว้เพื่อคง audit link ให้ caller (document_number+project_id
        // คือ dedupe key เดียวกับที่ import path ใช้ด้านล่าง)
        const replayedCorrespondence = await this.dataSource.manager.findOne(
          Correspondence,
          {
            where: {
              correspondenceNumber: existingTransaction.documentNumber,
              projectId: dto.projectId,
            },
            select: ['id', 'publicId'],
          }
        );
        if (!replayedCorrespondence) {
          // replay resolve ไม่เจอ — projectId mismatch กับ import เดิม หรือ correspondence
          // ถูกลบทิ้งแล้ว: audit link จะเป็น null — log ไว้ให้ตรวจสอบย้อนหลังได้
          this.logger.warn(
            `Idempotent replay resolved no correspondence for doc=${existingTransaction.documentNumber} projectId=${dto.projectId} — imported_correspondence_public_id will be NULL`
          );
        }
        return {
          message: 'Already processed',
          transaction: existingTransaction,
          correspondenceId: replayedCorrespondence?.id,
          correspondencePublicId: replayedCorrespondence?.publicId,
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
    // ADR-050 Decision 2: allowed_categories มาจาก correspondence_types.typeCode โดยตรง
    // ลบ CATEGORY_ALIAS hardcode map ทิ้ง — ตั้งแต่ ADR-050 เป็นต้นไป ค่า dto.correspondenceType ที่มาจาก
    // AI extraction ถูกบังคับให้เป็นหนึ่งใน allowed_categories (typeCode) อยู่แล้วโดย prompt
    // contract (§9) และ schema validation ฝั่ง ai-batch.processor จึงไม่ต้อง alias เดาความหมายอีก
    const type = await this.correspondenceTypeRepo.findOne({
      where: { typeName: dto.correspondenceType },
    });

    // If exact name isn't found, try typeCode just in case
    const typeId = type
      ? type.id
      : (
          await this.correspondenceTypeRepo.findOne({
            where: { typeCode: dto.correspondenceType },
          })
        )?.id;

    if (!typeId) {
      throw new ValidationException(
        `Category "${dto.correspondenceType}" not found in system`
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

    const isRFA = type?.typeCode === 'RFA' || dto.correspondenceType === 'RFA';

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
        // Bugfix: ส่ง queryRunner.manager เข้า importStagingFile เพื่อให้ attachment
        // ถูกสร้างใน transaction เดียวกัน — ป้องกัน MariaDB error 1020
        const importedAttachmentIds: number[] = [];
        for (const sfPath of dto.sourceFilePaths) {
          if (!sfPath || !sfPath.trim()) continue;
          try {
            const attachment = await this.fileStorageService.importStagingFile(
              sfPath,
              userId,
              {
                documentType: dto.correspondenceType,
                issueDate: dto.documentDate
                  ? new Date(dto.documentDate)
                  : undefined,
                manager: queryRunner.manager,
              }
            );
            importedAttachmentIds.push(attachment.id);
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
        allAttachmentIds.push(...importedAttachmentIds);
      } else if (dto.sourceFilePath && dto.sourceFilePath.trim()) {
        try {
          // Bugfix: ส่ง queryRunner.manager เข้า importStagingFile เพื่อให้ attachment
          // ถูกสร้างใน transaction เดียวกัน — ป้องกัน MariaDB error 1020
          const attachment = await this.fileStorageService.importStagingFile(
            dto.sourceFilePath,
            userId,
            {
              documentType: dto.correspondenceType,
              issueDate: dto.documentDate
                ? new Date(dto.documentDate)
                : undefined,
              manager: queryRunner.manager,
            }
          );
          attachmentId = attachment.id;
          allAttachmentIds.push(attachment.id);
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
          attachment_ids:
            allAttachmentIds.length > 0 ? allAttachmentIds : undefined,
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
            attachment_ids:
              allAttachmentIds.length > 0 ? allAttachmentIds : undefined,
          },
          schemaVersion: 1,
          createdBy: userId,
        });
        await queryRunner.manager.save(revision);
      }

      // Bugfix: เชื่อม attachments ทั้งหมดเข้ากับ revision ผ่าน junction table
      // (correspondence_revision_attachments) — เดิม importCorrespondence เก็บแค่
      // attachment_id ใน revision.details JSON ทำให้ frontend ซึ่ง query ผ่าน
      // junction table แสดง "No attachments found" แม้ว่า attachment มีอยู่จริง
      // ใช้ shared utility ร่วมกับ commitRecord เพื่อป้องกัน column name drift
      await linkAttachmentsToRevision(
        queryRunner.manager,
        revision.id,
        allAttachmentIds
      );

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
              "INSERT INTO tags (public_id, project_id, tag_name, color_code, created_by) VALUES (?, ?, ?, 'default', ?)",
              [uuidv7(), project.id, tagName, userId]
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

      // ADR-042/047 + Feature 254: route migration post-import ผ่าน RagAttachmentIngestProcessor
      // แทน deprecated EmbeddingService — สร้าง generation/chunk records และ persist ลง DB
      // ต้อง compute checksum ก่อนเพื่อให้ RagAttachmentIngestionService.ingest() ทำงานได้
      if (attachmentId) {
        const mainAttachment = await queryRunner.manager.findOne(Attachment, {
          where: { id: attachmentId },
          select: ['publicId', 'filePath', 'checksum', 'ragStatus'],
        });
        if (mainAttachment) {
          try {
            // 1. Compute SHA-256 checksum ถ้ายังไม่มี (migration attachments มักเป็น NULL)
            let checksum = mainAttachment.checksum ?? null;
            if (!checksum && mainAttachment.filePath) {
              checksum = await this.computeFileChecksum(
                mainAttachment.filePath
              );
              if (checksum) {
                await this.attachmentRepo.update(
                  { publicId: mainAttachment.publicId },
                  { checksum, ragStatus: 'PROCESSING' as const }
                );
                this.logger.log(
                  `Computed checksum for attachment ${mainAttachment.publicId}: ${checksum}`
                );
              }
            } else if (checksum) {
              // มี checksum อยู่แล้ว — แค่ตั้ง rag_status = PROCESSING
              await this.attachmentRepo.update(
                { publicId: mainAttachment.publicId },
                { ragStatus: 'PROCESSING' as const }
              );
            }

            // 2. สร้าง BUILDING generation ผ่าน ingestionService.ingest()
            if (checksum) {
              const generation = await this.ragIngestionService.ingest(
                mainAttachment.publicId
              );
              // 3. Enqueue ai-rag-ingest job ให้ RagAttachmentIngestProcessor ประมวลผล
              await this.aiQueueService.enqueueRagAttachmentIngestion({
                attachmentPublicId: mainAttachment.publicId,
                attachmentChecksum: checksum,
                force: false,
              });
              this.logger.log(
                `Post-import RAG ingestion enqueued for [${correspondence.publicId}] — generation=${generation.generationUuid}`
              );
            } else {
              // Fallback: ถ้าไม่มีไฟล์ (checksum compute ไม่ได้) ใช้ rag-prepare เดิม
              this.logger.warn(
                `No file to compute checksum for ${mainAttachment.publicId} — falling back to rag-prepare`
              );
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
            }
          } catch (ragErr: unknown) {
            const ragMsg =
              ragErr instanceof Error ? ragErr.message : String(ragErr);
            this.logger.warn(
              `Post-import RAG ingestion failed for [${correspondence.publicId}]: ${ragMsg}`
            );
            // ตั้ง rag_status = FAILED ถ้า ingestion ล้มเหลว
            await this.attachmentRepo
              .update(
                { publicId: mainAttachment.publicId },
                { ragStatus: 'FAILED' as const, ragLastError: ragMsg }
              )
              .catch(() => {});
          }
        }
      }

      this.logger.log(
        `Ingested document [${dto.documentNumber}] successfully (Batch: ${dto.batchId})`
      );

      return {
        message: 'Import successful',
        correspondenceId: correspondence.id,
        // ADR-054 US3 (T026a, FR-008): durable audit link → correspondences.uuid
        // (UUIDv7 string — ห้าม convert เป็น number ตาม ADR-019)
        correspondencePublicId: correspondence.publicId,
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
        statusCode: IMPORT_TX_STATUS_FAILED,
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
    queueItem.aiSuggestedCorrespondenceType = dto.correspondenceType;
    queueItem.aiIssues = dto.aiIssues;
    queueItem.projectId = dto.projectId;
    queueItem.senderOrganizationId = dto.senderOrgId;
    queueItem.receiverOrganizationId = dto.receiverOrgId;
    queueItem.remarks = dto.remarks;
    queueItem.aiSummary = dto.aiSummary;
    queueItem.extractedTags = dto.extractedTags;
    // temp_attachment_id (singular column ยังคงใช้เป็น fallback read path) — derive
    // จาก tempAttachmentIds[0] เมื่อ caller ส่ง array-only (deprecate singular field)
    queueItem.tempAttachmentId =
      dto.tempAttachmentId ?? dto.tempAttachmentIds?.[0];
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

    // ADR-054 T006 (FR-014): persist dto.details เข้า ai_metadata_json — เดิมถูก drop ทั้งก้อน
    // ทำให้ compareResult/capturedThresholds/disciplineId ที่ processMigrateDocument ส่งมาหายไป
    // merge กับค่าเดิมเสมอเพื่อไม่ทับ residual ingestion keys (original_row_index ฯลฯ)
    // Reviewer hardening: whitelist เฉพาะ keys ที่ processMigrateDocument ส่งจริง
    // (ALLOWED_ENQUEUE_DETAILS_KEYS) — กัน caller ฉีด source_file_path/fieldResolutions
    // เข้า bag ที่ถูก narrow แล้ว
    if (dto.details) {
      const filteredDetails: Record<string, unknown> = {};
      for (const key of ALLOWED_ENQUEUE_DETAILS_KEYS) {
        if (dto.details[key] !== undefined) {
          filteredDetails[key] = dto.details[key];
        }
      }
      queueItem.details = { ...(queueItem.details ?? {}), ...filteredDetails };
    }

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
   * ADR-050 Decision 2: allowed_categories สำหรับ AI extraction prompt (`{{allowed_categories}}`)
   * และสำหรับ schema validation ของ AI output — มาจาก correspondence_types.typeCode โดยตรง
   * ไม่มี hardcoded alias map อีกต่อไป
   */
  async getAllowedCategoryCodes(): Promise<string[]> {
    const types = await this.correspondenceTypeRepo.find();
    return types
      .map((t) => t.typeCode)
      .filter((code): code is string => !!code);
  }

  /**
   * ADR-050 Decision 3: คำนวณ requiresHumanReview แบบ deterministic ฝั่ง backend เสมอ
   * = min(ocrQualityConfidence, metadata.confidence.summary/.category/.tags) < minConfidence
   * ห้ามรับค่าที่ LLM ส่งมาเอง (ฟังก์ชันนี้รับเฉพาะตัวเลข confidence ไม่รับ raw LLM payload
   * จึงไม่มีทางอ่านค่า requiresHumanReview ที่ LLM อาจแนบมาได้เลย)
   * เมื่อไม่มี confidence ให้คำนวณได้เลย (เช่น ไม่มีข้อความอ่านได้) ให้ default เป็น true
   * (spec.md Edge Cases: "no readable text at all → must be flagged by default")
   */
  computeRequiresHumanReview(
    ocrQualityConfidence: number | null | undefined,
    metadataConfidence: Partial<MetadataConfidence> | null | undefined,
    minConfidence: number
  ): boolean {
    const values = [
      ocrQualityConfidence,
      metadataConfidence?.summary,
      metadataConfidence?.correspondenceType,
      metadataConfidence?.tags,
    ].filter((v): v is number => typeof v === 'number');
    if (values.length < 4) return true;
    // spec 250 FR-010: confidence ใด ๆ นอกช่วง [0,1] (รวม NaN — NaN ผ่าน typeof check
    // แต่ comparison ทั้งสองข้างเป็น false เสมอ) = AI output ผิดสัญญา ต้อง flag
    // manual attention แทนการ silent-accept
    if (values.some((v) => !(v >= 0 && v <= 1))) return true;
    return Math.min(...values) < minConfidence;
  }

  /**
   * ADR-050 Decision 1: backward-compat alias — ai_confidence (scalar เดิม) เขียนเป็น
   * min(metadata.confidence.summary, .category, .tags) เท่านั้น (ไม่รวม ocrQuality.confidence)
   */
  private computeAiConfidenceAlias(
    metadataConfidence: Partial<MetadataConfidence> | null | undefined
  ): number | undefined {
    const values = [
      metadataConfidence?.summary,
      metadataConfidence?.correspondenceType,
      metadataConfidence?.tags,
    ].filter((v): v is number => typeof v === 'number');
    if (values.length < 3) return undefined;
    return Math.min(...values);
  }

  /**
   * FR-011 / data-model.md: legacy item = extraction เสร็จแล้ว (aiStatus=DONE) แต่ details
   * ยังเป็น pre-ADR-050 shape (ไม่มี metadata.confidence ครบทั้ง 3 field) — ต้อง re-extract ก่อน
   * ถึงจะเปิดดูเพื่อ review ได้ (ไอเทมที่ยังไม่เคย extract เลย ไม่ถือเป็น legacy)
   */
  isLegacyExtractionShape(
    item: Pick<MigrationReviewQueue, 'aiStatus' | 'details'>
  ): boolean {
    if (item.aiStatus !== MigrationAiStatus.DONE) return false;
    const details = this.parseExtractionDetails(item.details);
    const confidence = details?.metadata?.confidence;
    return !(
      confidence &&
      typeof confidence.summary === 'number' &&
      typeof confidence.correspondenceType === 'number' &&
      typeof confidence.tags === 'number'
    );
  }

  /**
   * ADR-050: parse/validate `details` JSON จาก queue item ให้เป็น
   * MigrationAiExtractionDetails แบบ Partial หรือ null/undefined
   * ใช้ร่วมกันแทนการ cast กระจายทั่ว service
   */
  public parseExtractionDetails(
    raw: unknown
  ): Partial<MigrationAiExtractionDetails> | null | undefined {
    if (raw === undefined) return undefined;
    if (!raw || typeof raw !== 'object') return null;
    return raw as Partial<MigrationAiExtractionDetails>;
  }

  /**
   * อัปเดตผลลัพธ์จากการประมวลผล AI (OCR, Tags, Category, Confidence) ลงใน Staging Queue (ADR-047)
   * Edge Case 4: รองรับการ mark ai_failed เมื่อ BullMQ retry ครบแล้วยังไม่สำเร็จ
   * ADR-050: เมื่อ `data.details` เป็น shape ใหม่ (มี ocrQuality + metadata.confidence ครบ) จะคำนวณ
   * requiresHumanReview/ocrQualityConfidence/ai_confidence(alias) ให้อัตโนมัติบน write path เดียวกัน
   * (T010/T011/T012) — override ด้วย data.requiresHumanReview/data.ocrQualityConfidence ได้ตรงๆ
   * สำหรับ failure path ที่ไม่มี confidence ให้คำนวณ (เช่น ไม่มี PDF/OCR ล้มเหลว)
   */
  async updateQueueEnrichment(
    queueId: number,
    data: {
      ocrText?: string;
      aiSummary?: string;
      aiSuggestedCorrespondenceType?: string;
      extractedTags?: Record<string, string>[];
      aiConfidence?: number;
      aiIssues?: Record<string, unknown>[];
      aiFailed?: boolean;
      aiStatus?: MigrationAiStatus;
      status?: MigrationReviewStatus;
      details?: Record<string, unknown> | null;
      requiresHumanReview?: boolean;
      ocrQualityConfidence?: number | null;
      compareStatus?: CompareStatus;
      compareUnavailableReason?: string | null;
    }
  ) {
    const queueItem = await this.reviewQueueRepo.findOne({
      where: { id: queueId },
    });
    if (queueItem) {
      if (data.ocrText !== undefined) {
        // ADR-054 D5 (FR-006, T011): snapshot ocr_text จริงล่าสุดไป ocr_text_bak ก่อนเขียนทับ
        // — ข้ามเมื่อค่าปัจจุบันว่าง/null หรือเป็น known failure placeholder (bak ต้อง
        // เก็บ "ข้อความจริงล่าสุด" เสมอ — กฎนี้ครอบคลุมทุก extraction write path เพราะ
        // ทุก path ไหลผ่าน updateQueueEnrichment จุดเดียว)
        if (
          queueItem.ocrText &&
          queueItem.ocrText.trim().length > 0 &&
          !isOcrFailurePlaceholder(queueItem.ocrText)
        ) {
          queueItem.ocrTextBak = queueItem.ocrText;
        }
        queueItem.ocrText = data.ocrText;
      }
      if (data.aiSummary !== undefined) queueItem.aiSummary = data.aiSummary;
      if (data.aiSuggestedCorrespondenceType !== undefined)
        queueItem.aiSuggestedCorrespondenceType =
          data.aiSuggestedCorrespondenceType;
      if (data.extractedTags !== undefined)
        queueItem.extractedTags = data.extractedTags;
      if (data.aiConfidence !== undefined)
        queueItem.aiConfidence = data.aiConfidence;
      if (data.aiIssues !== undefined) queueItem.aiIssues = data.aiIssues;
      if (data.aiFailed !== undefined) queueItem.aiFailed = data.aiFailed;
      if (data.aiStatus !== undefined) queueItem.aiStatus = data.aiStatus;
      if (data.status !== undefined) queueItem.status = data.status;
      if (data.compareStatus !== undefined)
        queueItem.compareStatus = data.compareStatus;
      if (data.compareUnavailableReason !== undefined)
        queueItem.compareUnavailableReason = data.compareUnavailableReason;
      if (data.details !== undefined) {
        // รวมเข้ากับ details เดิมเสมอ เพื่อรักษา residual ingestion keys ที่ไม่มี
        // dedicated column (original_row_index, unresolved_orgs, original_document_number,
        // revision_number — ADR-054 D3) ไม่ให้ AI enrichment update ทับหาย
        // (file location ย้ายไป storageTempPath column แล้ว — ไม่มีใน bag อีก)
        queueItem.details = { ...(queueItem.details ?? {}), ...data.details };
        // ADR-050 T010/T011/T012: shape ใหม่ (ocrQuality + metadata.confidence ครบ) →
        // คำนวณ promoted columns + ai_confidence alias เสมอ ฝั่ง backend เท่านั้น
        const extraction = this.parseExtractionDetails(data.details);
        const metadataConfidence = extraction?.metadata?.confidence;
        // spec 250 FR-002/Edge Case: ขาด ocrQuality (OCR ไม่ผลิตข้อความ) ต้องยังคง
        // คำนวณ flag — computeRequiresHumanReview ให้ true เมื่อ confidence ครบ <4 ตัว
        if (
          metadataConfidence &&
          typeof metadataConfidence.summary === 'number' &&
          typeof metadataConfidence.correspondenceType === 'number' &&
          typeof metadataConfidence.tags === 'number'
        ) {
          const thresholds = await this.reviewThresholdService.getThresholds();
          queueItem.requiresHumanReview = this.computeRequiresHumanReview(
            extraction?.ocrQuality?.confidence,
            metadataConfidence,
            thresholds.minConfidence
          );
          const ocrConfidence = extraction?.ocrQuality?.confidence;
          queueItem.ocrQualityConfidence =
            typeof ocrConfidence === 'number' ? ocrConfidence : null;
          const aliasConfidence =
            this.computeAiConfidenceAlias(metadataConfidence);
          if (aliasConfidence !== undefined) {
            queueItem.aiConfidence = aliasConfidence;
          }
        }
      }
      // Override ตรง ๆ มีความสำคัญกว่าค่าที่คำนวณจาก details เสมอ (เช่น failure path ที่ไม่มี
      // confidence ให้คำนวณ — no-PDF/OCR-failed ต้อง flag requiresHumanReview=true ตาม spec.md
      // Edge Cases: "no readable text at all → must be flagged by default")
      if (data.requiresHumanReview !== undefined)
        queueItem.requiresHumanReview = data.requiresHumanReview;
      if (data.ocrQualityConfidence !== undefined)
        queueItem.ocrQualityConfidence = data.ocrQualityConfidence;
      await this.reviewQueueRepo.save(queueItem);
    }
  }

  /**
   * ADR-054 D1+D4 (FR-002, T010): resolve PDF path ของ queue item สำหรับ extractor
   * ลำดับ: `storageTempPath` column (เขียนตอน ingestion — resolved path หรือ bare
   * filename) → fallback `attachments.file_path` ผ่าน `tempAttachmentIds[0]`
   * (attachments คือ source of truth ของไฟล์จริง) → `undefined` เมื่อหาไม่ได้เลย
   * (extractor จะเขียน NO_PDF outcome ได้อย่างถูกต้อง โดย ocr_text_bak ยังรักษา
   * ข้อความเดิมไว้)
   * หมายเหตุ: ค่าที่เป็น filename ล้วนจะถูก resolve เป็น full path โดย viewer/staging
   * resolver (getStagingFileStream — D330 recursive search) ไม่ใช่ที่ extraction path —
   * OcrService อ่าน pdfPath ตรงๆ ตามค่าที่ resolve คืนมาจากที่นี่
   * ห้าม fallback ไป `details.source_file_path` — key นั้นตายแล้วหลัง restart (R2)
   */
  private async resolveQueuePdfPath(
    queueItem: MigrationReviewQueue
  ): Promise<string | undefined> {
    if (
      queueItem.storageTempPath &&
      queueItem.storageTempPath.trim().length > 0
    ) {
      return queueItem.storageTempPath;
    }
    const attachmentId = queueItem.tempAttachmentIds?.[0];
    if (attachmentId != null) {
      const attachment = await this.dataSource.manager.findOne(Attachment, {
        where: { id: attachmentId },
        select: ['id', 'filePath'],
      });
      if (attachment?.filePath) {
        return attachment.filePath;
      }
    }
    return undefined;
  }

  /**
   * ADR-047: เริ่มประมวลผล OCR/AI ของ queue item เดียว โดย enqueue legacy-ai-enrichment job
   */
  async startExtractQueueItem(
    publicId: string,
    idempotencyKey: string,
    userId: number
  ) {
    const queueItem = await this.fetchQueueItemByPublicId(publicId);
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

    // ADR-054 FR-002 (T010): หา source PDF path จาก storageTempPath column ก่อน
    // (resolvedPdfPath จาก LegacyIngestionService เป็น absolute path) แล้ว fallback
    // ไป attachments.file_path ผ่าน tempAttachmentIds[0] — ห้ามอ่าน details.source_file_path
    const pdfPath = await this.resolveQueuePdfPath(queueItem);

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
        // Snapshot ข้อมูลทะเบียนก่อน re-extract เพื่อให้ worker rebuild compareResult
        // จาก register values เดิม ไม่เปรียบเทียบกับ AI output ที่เพิ่งสร้างเอง
        excelMetadata: {
          documentNumber: queueItem.documentNumber,
          subject: queueItem.subject ?? queueItem.originalSubject ?? '',
          documentDate:
            queueItem.issuedDate instanceof Date
              ? queueItem.issuedDate.toISOString().slice(0, 10)
              : queueItem.issuedDate
                ? String(queueItem.issuedDate)
                : '',
          correspondenceType:
            typeof queueItem.details?.['correspondence_type'] === 'string'
              ? queueItem.details['correspondence_type']
              : '',
          discipline:
            typeof queueItem.details?.['discipline'] === 'string'
              ? queueItem.details['discipline']
              : '',
          revision:
            typeof queueItem.details?.['revision_number'] === 'string'
              ? queueItem.details['revision_number']
              : '',
        },
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
        // BullMQ ห้าม ':' ใน custom jobId — sanitize idempotencyKey ที่มาจาก caller
        jobId: `legacy-enrich-${queueItem.publicId}-${idempotencyKey.replace(/:/g, '-')}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      }
    );

    queueItem.aiStatus = MigrationAiStatus.WAITING;
    queueItem.aiJobId = String(job.id);
    // ADR-054 (reviewer fold): fetchQueueItemByPublicId ผ่าน enrichWithAttachments ฉีด
    // transient `attachments[]` เข้า details เพื่อ serialize ออก API เท่านั้น
    // (data-model.md ownership matrix — ไม่ persist) — ลบออกก่อน save ไม่ให้หลุดลง
    // ai_metadata_json (re-extract whitelist จะ drop มันใน cycle ถัดไปอยู่แล้ว แต่กัน
    // ไม่ให้มันถูกเขียนตั้งแต่แรก)
    if (queueItem.details && typeof queueItem.details === 'object') {
      delete queueItem.details['attachments'];
    }
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
   * Two-phase batch OCR/AI extraction, phase 2 enqueue (D267) — เรียกโดย
   * `AiBatchProcessor.processLegacyOcrBatchPhase()` หลังจบ OCR phase ของทั้ง batch (main
   * model reload กลับแล้ว) เพื่อส่ง 1 job/เอกสารทำ LLM metadata extraction ต่อ ส่ง ocrText ที่
   * สกัดไว้แล้วไปพร้อม job data เลย (ไม่ต้องอ่านกลับจาก DB) เพื่อลด round-trip
   */
  async enqueueLegacyAiMetadataOnly(
    item: {
      queueId: number;
      queuePublicId: string;
      documentNumber: string;
      projectId: number | null;
      projectPublicId: string;
      excelMetadata?: Record<string, unknown>;
    },
    ocrResult: { ocrText: string; ocrFailed: boolean; hasPdf: boolean }
  ): Promise<string> {
    const job = await this.aiBatchQueue.add(
      'legacy-ai-metadata-only',
      {
        jobType: 'legacy-ai-metadata-only',
        documentPublicId: item.queuePublicId,
        queueId: item.queueId,
        documentNumber: item.documentNumber,
        projectId: item.projectId,
        projectPublicId: item.projectPublicId,
        excelMetadata: item.excelMetadata,
        ocrText: ocrResult.ocrText,
        ocrFailed: ocrResult.ocrFailed,
        hasPdf: ocrResult.hasPdf,
      },
      {
        jobId: `legacy-metadata-${item.queuePublicId}-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      }
    );
    return String(job.id);
  }

  /**
   * ADR-047: re-extract queue item ก่อน Execute Import
   * ล้างผลลัพธ์เก่า ลบ BullMQ job เดิม (best-effort) แล้ว enqueue `legacy-ai-enrichment` ใหม่
   */
  async reExtractQueueItem(
    publicId: string,
    idempotencyKey: string,
    userId: number
  ) {
    const queueItem = await this.fetchQueueItemByPublicId(publicId);

    if (
      queueItem.status !== MigrationReviewStatus.PENDING &&
      queueItem.status !== MigrationReviewStatus.PENDING_REVIEW
    ) {
      throw new ConflictException(
        'MIGRATION_INVALID_STATE',
        `Queue item ${publicId} is ${queueItem.status}`,
        'รายการนี้ไม่อยู่ในสถานะทีสามารถ re-extract ได้'
      );
    }

    if (queueItem.aiStatus === MigrationAiStatus.RUNNING) {
      return {
        message: 'AI extraction currently running',
        jobId: queueItem.aiJobId,
      };
    }
    // กัน re-extract item ที่ import แล้ว — status guard ข้างบนผ่านได้ถ้า link ค้าง
    // จาก stale state (incident BATCH-ADR054-E2E-001)
    this.assertNotAlreadyImported(queueItem);

    if (queueItem.aiJobId) {
      try {
        await this.aiBatchQueue.remove(queueItem.aiJobId);
        this.logger.log(
          `Removed previous ai-batch job ${queueItem.aiJobId} for re-extract ${publicId}`
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to remove previous ai-batch job ${queueItem.aiJobId}: ${errMsg}`
        );
      }
    }

    // ADR-054 D5 (FR-006, T012): snapshot ocr_text จริงล่าสุดไป ocr_text_bak ก่อน null —
    // ข้ามเมื่อค่าปัจจุบันเป็น known failure placeholder เพื่อให้ bak เก็บข้อความจริงเสมอ
    if (
      queueItem.ocrText &&
      queueItem.ocrText.trim().length > 0 &&
      !isOcrFailurePlaceholder(queueItem.ocrText)
    ) {
      queueItem.ocrTextBak = queueItem.ocrText;
    }

    // ADR-054 D3/D9 (FR-005): rebuild details ผ่าน whitelist — เก็บเฉพาะ residual
    // ingestion keys ที่ไม่มี dedicated column; key อื่นทั้งหมดถือเป็น AI output ถูกล้าง
    // (defense-in-depth — หลัง D9 bag มีแค่ AI output + residual keys อยู่แล้ว)
    const existingDetails =
      queueItem.details && typeof queueItem.details === 'object'
        ? queueItem.details
        : {};
    const preservedDetails: Record<string, unknown> = {};
    for (const key of REEXTRACT_PRESERVED_DETAILS_KEYS) {
      if (existingDetails[key] !== undefined) {
        preservedDetails[key] = existingDetails[key];
      }
    }

    queueItem.aiStatus = MigrationAiStatus.PENDING;
    queueItem.aiJobId = null;
    queueItem.aiFailed = false;
    queueItem.ocrText = null;
    queueItem.aiSummary = null;
    queueItem.aiSuggestedCorrespondenceType = null;
    queueItem.extractedTags = null;
    queueItem.aiConfidence = null;
    queueItem.aiIssues = null;
    // AI-derived review flags ต้อง reset ด้วย (R5) — ค่าใหม่จะถูกคำนวณใหม่ตอน extraction
    queueItem.requiresHumanReview = false;
    queueItem.ocrQualityConfidence = null;
    // review_reason column nullable แต่ entity type เป็น string|undefined —
    // reset เป็น NULL ผ่าน Record view (undefined จะไม่ถูก persist โดย TypeORM)
    (queueItem as unknown as Record<string, unknown>)['reviewReason'] = null;
    // compare_result ถูกล้างพร้อม details — compare_status NOT NULL เลยต้องเป็น
    // UNAVAILABLE (ไม่ใช่ NULL) พร้อมเหตุผล เพื่อไม่ให้ list badge แสดง "เปรียบเทียบแล้ว"
    // ทั้งที่ไม่มี compare data เหลืออยู่
    queueItem.compareStatus = CompareStatus.UNAVAILABLE;
    queueItem.compareUnavailableReason =
      'ข้อมูลเปรียบเทียบถูกรีเซ็ตระหว่าง re-extract — ระบบจะเปรียบเทียบใหม่เมื่อ extraction สำเร็จ';
    queueItem.details = preservedDetails;
    queueItem.status = MigrationReviewStatus.PENDING;
    // ห้ามแตะ: storageTempPath, originalFilename, tempAttachmentIds, reviewState,
    // ocrTextBak (เกินกว่า snapshot ด้านบน) — ทั้งหมดอยู่นอกขอบเขต reset ของ re-extract
    await this.reviewQueueRepo.save(queueItem);

    this.logger.log(
      `User ${userId} reset AI extraction for queue ${publicId}, re-enqueue with idem ${idempotencyKey}`
    );

    return this.startExtractQueueItem(publicId, idempotencyKey, userId);
  }

  /**
   * เปลี่ยนไฟล์ต้นฉบับของ queue item แล้ว re-extract อัตโนมัติ (PATCH /migration/queue/:publicId/file)
   *
   * รองรับ 2 แหล่งไฟล์ (ส่งอย่างใดอย่างหนึ่งใน DTO):
   * - `storageTempPath` — PDF บน staging/Legacy NAS: validate ใต้ allowed roots
   *   (path-traversal guard ชุดเดียวกับ getStagingFileStream) แล้ว find-or-create
   *   attachment row แบบเดียวกับ legacy ingestion (isTemporary=false)
   * - `tempAttachmentPublicId` — attachment ชั่วคราวจาก POST /files/upload
   *   (isTemporary=true — commit จะย้ายเข้า permanent ผ่าน two-phase ปกติ)
   *
   * ทุกกรณี: ผูก attachment เข้า tempAttachmentIds, อัปเดต storageTempPath/
   * originalFilename, บันทึก audit record ลง reviewState.fileReplacements
   * (column ของมนุษย์ — re-extract ไม่ลบ) แล้วเรียก reExtractQueueItem เพื่อ
   * snapshot OCR เดิม + reset AI fields + enqueue extraction กับไฟล์ใหม่
   * — ป้องกัน commit ข้อมูล AI ค้างจากไฟล์เก่าโดยไม่ได้ extract ใหม่
   *
   * @param publicId UUIDv7 ของ queue item
   * @param dto แหล่งไฟล์ใหม่ (storageTempPath XOR tempAttachmentPublicId)
   * @param idempotencyKey Idempotency-Key (ADR-016) — replay จะคืนสถานะปัจจุบันโดยไม่ re-enqueue
   * @param userId id ผู้ใช้ที่เปลี่ยนไฟล์
   */
  async replaceQueueItemFile(
    publicId: string,
    dto: ReplaceQueueFileDto,
    idempotencyKey: string,
    userId: number
  ) {
    const queueItem = await this.fetchQueueItemByPublicId(publicId);

    const hasStagingPath = !!dto.storageTempPath?.trim();
    const hasAttachment = !!dto.tempAttachmentPublicId;
    if (hasStagingPath === hasAttachment) {
      throw new ValidationException(
        'Provide exactly one of storageTempPath or tempAttachmentPublicId'
      );
    }

    if (
      queueItem.status !== MigrationReviewStatus.PENDING &&
      queueItem.status !== MigrationReviewStatus.PENDING_REVIEW
    ) {
      throw new ConflictException(
        'MIGRATION_INVALID_STATE',
        `Queue item ${publicId} is ${queueItem.status}`,
        'รายการนี้ไม่อยู่ในสถานะที่สามารถเปลี่ยนไฟล์ได้'
      );
    }
    // ห้ามเปลี่ยนไฟล์กลาง extraction — race กับ worker ที่กำลังอ่าน path เดิม
    if (queueItem.aiStatus === MigrationAiStatus.RUNNING) {
      throw new ConflictException(
        'MIGRATION_EXTRACTION_RUNNING',
        `Queue item ${publicId} extraction is running`,
        'กำลังประมวลผล AI อยู่ ไม่สามารถเปลี่ยนไฟล์ได้ — รอให้เสร็จก่อน'
      );
    }
    // กันเปลี่ยนไฟล์บน item ที่ import แล้ว — link ค้างอยู่แต่ status guard ผ่านได้
    this.assertNotAlreadyImported(queueItem);

    // ADR-016: idempotent replay — ถ้า key นี้ถูกบันทึกใน audit แล้ว คืนสถานะเดิม
    const previousReplacements = queueItem.reviewState?.fileReplacements ?? [];
    const alreadyApplied = previousReplacements.some(
      (r) => r.idempotencyKey === idempotencyKey
    );
    if (alreadyApplied) {
      return {
        message: 'File replacement already applied',
        publicId: queueItem.publicId,
        idempotentReplay: true,
      };
    }

    const previousPath = queueItem.storageTempPath ?? null;
    let resolvedPath: string;
    let attachment: Attachment;
    let source: MigrationFileReplacement['source'];

    if (hasStagingPath) {
      // โหมด A: เลือกจาก staging/Legacy NAS — guard ชุดเดียวกับ getStagingFileStream
      source = 'STAGING';
      resolvedPath = path.resolve(dto.storageTempPath!.trim());
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
          `Path traversal blocked on replaceQueueItemFile: "${dto.storageTempPath}" resolves outside allowed dirs`
        );
        throw new ValidationException(
          'Invalid file path — access denied (path traversal guard)'
        );
      }
      if (
        !existsSync(resolvedPath) ||
        !statSync(resolvedPath).isFile() ||
        !resolvedPath.toLowerCase().endsWith('.pdf')
      ) {
        throw new NotFoundException('PDF file', resolvedPath);
      }
      // find-or-create attachment row (dedup by filePath — pattern เดียวกับ legacy ingestion)
      const existing = await this.attachmentRepo.findOne({
        where: { filePath: resolvedPath },
      });
      if (existing) {
        attachment = existing;
      } else {
        const fileStats = statSync(resolvedPath);
        const baseName = path.basename(resolvedPath);
        attachment = await this.attachmentRepo.save(
          this.attachmentRepo.create({
            originalFilename: baseName,
            storedFilename: baseName,
            filePath: resolvedPath,
            mimeType: 'application/pdf',
            fileSize: fileStats.size,
            isTemporary: false,
            uploadedByUserId: userId,
            aiProcessingStatus: 'PENDING',
            classification: 'INTERNAL',
            effectiveClassification: 'INTERNAL',
          })
        );
      }
    } else {
      // โหมด B: attachment ชั่วคราวจาก POST /files/upload (ADR-019: รับ publicId เท่านั้น)
      source = 'UPLOAD';
      const uploaded = await this.attachmentRepo.findOne({
        where: { publicId: dto.tempAttachmentPublicId },
      });
      if (!uploaded) {
        throw new NotFoundException('Attachment', dto.tempAttachmentPublicId);
      }
      if (!uploaded.isTemporary) {
        throw new ValidationException(
          'Attachment is not a temporary upload — cannot bind to migration queue'
        );
      }
      attachment = uploaded;
      resolvedPath = uploaded.filePath;
    }

    queueItem.tempAttachmentIds = [attachment.id];
    queueItem.tempAttachmentId = attachment.id;
    queueItem.storageTempPath = resolvedPath;
    queueItem.originalFilename =
      attachment.originalFilename || path.basename(resolvedPath);

    const replacement: MigrationFileReplacement = {
      idempotencyKey,
      at: new Date().toISOString(),
      userId,
      source,
      previousPath,
      newPath: resolvedPath,
      filename: path.basename(resolvedPath),
      attachmentPublicId: attachment.publicId,
    };
    queueItem.reviewState = {
      ...(queueItem.reviewState ?? {}),
      fileReplacements: [...previousReplacements, replacement],
    };
    await this.reviewQueueRepo.save(queueItem);

    this.logger.log(
      `User ${userId} replaced file for queue ${publicId} (${source}): ${previousPath} -> ${resolvedPath}`
    );

    // Auto re-extract — reset AI fields ที่ stale จากไฟล์เก่า + enqueue กับไฟล์ใหม่
    const reExtract = await this.reExtractQueueItem(
      publicId,
      `${idempotencyKey}-reextract`,
      userId
    );
    return {
      message: 'File replaced — re-extraction started',
      publicId: queueItem.publicId,
      attachmentPublicId: attachment.publicId,
      source,
      reExtract,
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
    // 0-1 เอกสาร: ใช้ path เดิม (ไม่มีปัญหา model-swap ซ้ำที่ two-phase orchestrator แก้ อยู่แล้ว
    // เมื่อมีแค่เอกสารเดียว — ไม่ผ่าน legacy-ocr-batch-phase, พฤติกรรม/contract เดิมไม่เปลี่ยน)
    if (publicIds.length <= 1) {
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

    // D267: หลายเอกสาร (N>1) → enqueue orchestrator job เดียว (`legacy-ocr-batch-phase`) แทน
    // การ enqueue N `legacy-ai-enrichment` jobs แยก เพื่อลด Ollama model swap จาก 2N เหลือ 2
    // ครั้งต่อ batch — validate ทุก publicId ก่อน (guard เดียวกับ startExtractQueueItem) แล้ว
    // รวมเฉพาะรายการที่ผ่านเป็น items[] ให้ orchestrator job เดียว
    const results: Array<{
      publicId: string;
      message?: string;
      jobId?: string | null;
      error?: string;
    }> = [];
    const items: Array<{
      queueId: number;
      queuePublicId: string;
      documentNumber: string;
      pdfPath?: string;
      projectId: number | null;
      projectPublicId: string;
      excelMetadata: Record<string, unknown>;
    }> = [];

    for (const publicId of publicIds) {
      try {
        const queueItem = await this.fetchQueueItemByPublicId(publicId);
        if (queueItem.status !== MigrationReviewStatus.PENDING) {
          results.push({
            publicId,
            error: `Queue item ${publicId} is ${queueItem.status}`,
          });
          continue;
        }
        if (
          queueItem.aiStatus === MigrationAiStatus.RUNNING ||
          (queueItem.aiJobId != null &&
            queueItem.aiStatus !== MigrationAiStatus.FAILED)
        ) {
          results.push({
            publicId,
            message: 'AI extraction already running or queued',
            jobId: queueItem.aiJobId,
          });
          continue;
        }
        // ADR-054 FR-002 (T010): storageTempPath → attachments.file_path fallback
        // resolve ตอน enqueue เพราะ job payload ถูก freeze (ตาม tasks.md T010)
        const pdfPath = await this.resolveQueuePdfPath(queueItem);
        const projectPublicId = queueItem.projectId
          ? ((
              await this.projectRepo.findOne({
                where: { id: queueItem.projectId },
              })
            )?.publicId ?? '00000000-0000-0000-0000-000000000000')
          : '00000000-0000-0000-0000-000000000000';
        items.push({
          queueId: queueItem.id,
          queuePublicId: queueItem.publicId,
          documentNumber: queueItem.documentNumber,
          pdfPath,
          projectId: queueItem.projectId ?? null,
          projectPublicId,
          excelMetadata: {
            documentNumber: queueItem.documentNumber,
            subject: queueItem.subject ?? queueItem.originalSubject ?? '',
            documentDate:
              queueItem.issuedDate instanceof Date
                ? queueItem.issuedDate.toISOString().slice(0, 10)
                : queueItem.issuedDate
                  ? String(queueItem.issuedDate)
                  : '',
            correspondenceType:
              typeof queueItem.details?.['correspondence_type'] === 'string'
                ? queueItem.details['correspondence_type']
                : '',
            discipline:
              typeof queueItem.details?.['discipline'] === 'string'
                ? queueItem.details['discipline']
                : '',
            revision:
              typeof queueItem.details?.['revision_number'] === 'string'
                ? queueItem.details['revision_number']
                : '',
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ publicId, error: msg });
      }
    }

    if (items.length === 0) {
      return { results };
    }

    const job = await this.aiBatchQueue.add(
      'legacy-ocr-batch-phase',
      {
        jobType: 'legacy-ocr-batch-phase',
        documentPublicId: '00000000-0000-0000-0000-000000000000',
        items,
      },
      {
        jobId: `legacy-ocr-batch-${idempotencyKey.replace(/:/g, '-')}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    );

    for (const item of items) {
      await this.reviewQueueRepo.update(item.queueId, {
        aiStatus: MigrationAiStatus.WAITING,
        aiJobId: String(job.id),
      });
      this.logger.log(
        `User ${userId} started batch AI extraction for queue ${item.queuePublicId}, orchestrator jobId ${String(job.id)}`
      );
      results.push({
        publicId: item.queuePublicId,
        message: 'AI extraction batch started',
        jobId: String(job.id),
      });
    }

    return { results };
  }

  async getReviewQueue(query: MigrationQueueQueryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      aiStatus,
      batchId,
      requiresHumanReview,
      correspondenceType,
      confidenceBucket,
      sortBy,
      sortOrder = 'asc',
    } = query;
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
    // ADR-050/FR-003 (T019): filter to only items requiring human review
    if (requiresHumanReview !== undefined) {
      queryBuilder.andWhere(
        'queue.requiresHumanReview = :requiresHumanReview',
        { requiresHumanReview }
      );
    }
    // filter ตามประเภทเอกสารที่ AI แนะนำ (type_code เช่น RFA, LETTER)
    if (correspondenceType) {
      queryBuilder.andWhere(
        'queue.aiSuggestedCorrespondenceType = :correspondenceType',
        { correspondenceType }
      );
    }
    // filter ตามช่วง aiConfidence — เกณฑ์เดียวกับ badge บนหน้า Legacy Review Queue
    // (badge: <=0.5 = destructive, 0.5<x<=0.8 = secondary, >0.8 = default, NULL = N/A)
    if (confidenceBucket === 'low') {
      queryBuilder.andWhere('queue.aiConfidence <= :confLow', { confLow: 0.5 });
    } else if (confidenceBucket === 'mid') {
      queryBuilder.andWhere(
        'queue.aiConfidence > :confMidMin AND queue.aiConfidence <= :confMidMax',
        { confMidMin: 0.5, confMidMax: 0.8 }
      );
    } else if (confidenceBucket === 'high') {
      queryBuilder.andWhere('queue.aiConfidence > :confHigh', {
        confHigh: 0.8,
      });
    } else if (confidenceBucket === 'missing') {
      queryBuilder.andWhere('queue.aiConfidence IS NULL');
    }

    // ADR-050/FR-004 (T019): sort by ocrQualityConfidence when requested,
    // otherwise preserve the existing default sort (createdAt DESC)
    if (sortBy === 'ocrQualityConfidence') {
      queryBuilder.orderBy(
        'queue.ocrQualityConfidence',
        sortOrder === 'desc' ? 'DESC' : 'ASC'
      );
    } else {
      queryBuilder.orderBy('queue.createdAt', 'DESC');
    }
    queryBuilder.skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    // Feature 242: enrich items with attachments[] metadata (FR-005)
    let enrichedItems = await this.enrichWithAttachments(items);

    // Enrich ชื่อ organization_code และชื่อประเภทเอกสารเพื่อแสดงผลในหน้า Legacy Management
    enrichedItems = await this.enrichWithReferenceData(enrichedItems);

    // ADR-054 (reviewer fold): list rows ไม่ส่ง ocr_text_bak (LONGTEXT — payload ใหญ่)
    // expose เฉพาะ presence flag `hasOcrTextBak` แทน (detail path ยังคงส่งค่าเต็ม) —
    // mutate entity instance ตรงๆ เพื่อให้ @Exclude (instanceToPlain) ยังทำงานกับ
    // internal id fields เหมือนเดิม
    for (const item of enrichedItems) {
      (
        item as MigrationReviewQueue & { hasOcrTextBak: boolean }
      ).hasOcrTextBak =
        typeof item.ocrTextBak === 'string' &&
        item.ocrTextBak.trim().length > 0;
      delete item.ocrTextBak;
    }

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
      if (item.aiSuggestedCorrespondenceType)
        typeCodes.add(item.aiSuggestedCorrespondenceType);
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
      item.aiSuggestedCorrespondenceTypeName =
        typeMap.get(item.aiSuggestedCorrespondenceType ?? '')?.typeName ??
        item.aiSuggestedCorrespondenceType ??
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
    // ADR-054: expose hasOcrTextBak flag เหมือน list endpoint (detail คงส่ง ocrTextBak
    // เต็มตาม contract — frontend ใช้ flag ตัดสินแสดงปุ่ม restore)
    (
      enriched[0] as MigrationReviewQueue & { hasOcrTextBak: boolean }
    ).hasOcrTextBak =
      typeof enriched[0].ocrTextBak === 'string' &&
      enriched[0].ocrTextBak.trim().length > 0;
    return enriched[0];
  }

  /**
   * ADR-019: ค้นหา queue item ด้วย publicId (UUIDv7) แทน INT PK — internal fetch ไม่มี legacy
   * guard ใช้เฉพาะภายใน service สำหรับ flow ที่ต้อง "เปิดทางไว้เสมอ" เช่น re-extract
   * (ADR-050/FR-011: ห้าม block เส้นทาง re-extract — ผู้ใช้ต้อง re-extract legacy item ได้)
   */
  private async fetchQueueItemByPublicId(publicId: string) {
    const item = await this.reviewQueueRepo.findOne({
      where: { publicId },
    });
    if (!item) {
      throw new NotFoundException('Queue item', publicId);
    }
    let enriched = await this.enrichWithAttachments([item]);
    enriched = await this.enrichWithReferenceData(enriched);
    // ADR-054: expose hasOcrTextBak flag เหมือน list endpoint (detail คงส่ง ocrTextBak
    // เต็มตาม contract — frontend ใช้ flag ตัดสินแสดงปุ่ม restore)
    (
      enriched[0] as MigrationReviewQueue & { hasOcrTextBak: boolean }
    ).hasOcrTextBak =
      typeof enriched[0].ocrTextBak === 'string' &&
      enriched[0].ocrTextBak.trim().length > 0;
    return enriched[0];
  }

  /**
   * ADR-019: ค้นหา queue item ด้วย publicId (UUIDv7) แทน INT PK
   * ใช้สำหรับ public API endpoints (review-mode access) เพื่อไม่ leak internal row id
   * ADR-050/FR-011/SC-006: ปฏิเสธด้วย BusinessException ถ้าเป็น legacy-shaped item (extraction
   * เสร็จแล้วแต่ยังไม่มี metadata.confidence ตาม contract ใหม่) — reviewer ต้องสั่ง re-extract
   * ก่อนถึงจะเปิดดูเพื่อ review ได้ (frontend-only hiding ไม่พอ — ปิดช่องโหว่จาก /106-speckit-analyze
   * finding C2) เส้นทาง re-extract เองใช้ fetchQueueItemByPublicId ที่ไม่มี guard นี้แทน
   */
  async getQueueItemByPublicId(publicId: string) {
    const item = await this.fetchQueueItemByPublicId(publicId);
    if (this.isLegacyExtractionShape(item)) {
      throw new BusinessException(
        'MIGRATION_LEGACY_ITEM_NOT_REVIEWABLE',
        `Queue item ${publicId} was processed before ADR-050 and lacks the new confidence contract — re-extraction required`,
        'รายการนี้ประมวลผลด้วยระบบเก่า (ก่อน ADR-050) ยังไม่มีข้อมูล confidence รูปแบบใหม่ กรุณาสั่ง Re-extract ก่อนเปิดตรวจสอบ',
        ['กด "Re-extract" เพื่อประมวลผลใหม่ด้วย AI contract ปัจจุบัน']
      );
    }
    return item;
  }

  /**
   * ADR-054 D5 (FR-007, T014): กู้คืน `ocr_text` จาก `ocr_text_bak` รายรายการ
   * — restore เป็น non-destructive (ไม่ลบ bak) เพื่อให้กู้ซ้ำ/ตรวจสอบย้อนหลังได้เสมอ
   * ใช้ reviewQueueRepo.findOne ตรงๆ (ไม่ผ่าน fetchQueueItemByPublicId เพราะไม่ต้องการ
   * enrichment ของ attachments/reference data)
   * @param publicId UUIDv7 ของ queue item
   * @param userId actor ที่สั่ง restore (audit log)
   */
  async restoreOcrText(
    publicId: string,
    userId: number
  ): Promise<{ publicId: string; ocrTextLength: number; restored: true }> {
    const queueItem = await this.reviewQueueRepo.findOne({
      where: { publicId },
    });
    if (!queueItem) {
      throw new NotFoundException('Queue item', publicId);
    }
    if (!queueItem.ocrTextBak || queueItem.ocrTextBak.trim().length === 0) {
      // ADR-007: BusinessException พร้อม Thai userMessage + recovery guidance
      throw new BusinessException(
        'MIGRATION_NO_BACKUP',
        `Queue item ${publicId} has no ocr_text_bak to restore`,
        'ไม่มีสำเนา OCR text สำรองสำหรับรายการนี้',
        [
          'ตรวจสอบว่ารายการนี้เคยถูกเขียนทับ OCR text จริงหรือไม่ (snapshot เกิดเฉพาะตอน overwrite)',
          'หากต้องการ OCR text ให้กด Re-extract หรือแก้ไข OCR text ด้วยตนเอง',
          'ติดต่อผู้ดูแลระบบหากเชื่อว่าข้อความเดิมสูญหาย',
        ]
      );
    }
    // ADR-054 D5 hardening: ถ้า ocr_text ปัจจุบันเป็นข้อความจริงที่ไม่เคยถูก snapshot
    // (เช่น manual edit หลัง backup ล่าสุด) — swap เข้า ocr_text_bak แทนการเขียนทับทิ้ง
    // ทำให้ restore เป็น toggle ระหว่างข้อความจริง 2 เวอร์ชัน และไม่มี real text สูญหาย
    const previousOcrText = queueItem.ocrText;
    queueItem.ocrText = queueItem.ocrTextBak;
    if (
      previousOcrText &&
      previousOcrText.trim().length > 0 &&
      !isOcrFailurePlaceholder(previousOcrText)
    ) {
      queueItem.ocrTextBak = previousOcrText;
    }
    await this.reviewQueueRepo.save(queueItem);
    this.logger.log(
      `User ${userId} restored OCR text backup for queue ${publicId} (ocrTextLength=${queueItem.ocrText.length})`
    );
    return {
      publicId,
      ocrTextLength: queueItem.ocrText.length,
      restored: true,
    };
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
    // TypeORM ปฏิเสธ delete({}) ด้วย empty conditions (safety feature)
    // ใช้ id: MoreThanOrEqual(0) เป็น wildcard เหมือน deleteErrorsByBatch
    let conditions: FindOptionsWhere<MigrationReviewQueue> = {
      id: MoreThanOrEqual(0),
    };

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

  /**
   * ADR-050 human-in-the-loop: รายการที่ AI ตั้ง requiresHumanReview (confidence ต่ำกว่า
   * threshold หรือ extraction ล้มเหลว) ต้อง commit ผ่าน commitRecord (POST /ai/migration/review)
   * เท่านั้น เพราะ path นั้นบังคับ per-field gate + fieldAcknowledgments — endpoint
   * /migration/queue/:id/approve ไม่มีช่องทางให้ reviewer resolve field จึง block ไว้ตรงนี้
   */
  private assertNotFlaggedForReview(queueItem: MigrationReviewQueue): void {
    if (queueItem.requiresHumanReview === true || queueItem.aiFailed === true) {
      throw new BusinessException(
        'MIGRATION_REQUIRES_MANUAL_REVIEW',
        `Queue item ${queueItem.publicId} is flagged for human review and cannot be imported via this endpoint`,
        'รายการนี้ถูก flag ให้ตรวจสอบด้วยมนุษย์ — กรุณาเปิดหน้า Review เพื่อตรวจสอบและยืนยันแต่ละ field ก่อนนำเข้า',
        [
          'เปิดหน้า Review Detail ของรายการนี้',
          'ตรวจสอบ confidence ของแต่ละ field แล้วกดยืนยัน/แก้ไขก่อน commit',
        ]
      );
    }
  }

  /**
   * Guard: queue item ที่ import ไปแล้ว (importedCorrespondencePublicId ค้างอยู่)
   * ห้าม re-extract / replace file / re-import ทุก path — กัน duplicate Correspondence
   * และกัน mismatch ที่ status กลับ PENDING_REVIEW ทั้งที่ link ยังชี้เอกสารเดิม
   * (incident 2026-09-15: BATCH-ADR054-E2E-001 มี correspondence แล้วแต่ถูก import ซ้ำได้)
   */
  assertNotAlreadyImported(queueItem: MigrationReviewQueue): void {
    if (queueItem.importedCorrespondencePublicId) {
      throw new ConflictException(
        'MIGRATION_ALREADY_IMPORTED',
        `Queue item ${queueItem.publicId} already imported as correspondence ${queueItem.importedCorrespondencePublicId}`,
        'รายการนี้ถูก import เป็น Correspondence ไปแล้ว — ไม่สามารถ re-extract เปลี่ยนไฟล์ หรือ import ซ้ำได้'
      );
    }
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

    // ADR-050: รายการที่ถูก flag requiresHumanReview (confidence ต่ำ / AI hard-failure)
    // ต้องผ่าน commit gate ที่ /ai/migration/review (commitRecord) เท่านั้น — endpoint นี้
    // ไม่มี fieldAcknowledgments/tagDecisions ให้ reviewer resolve field จึง block ตรง ๆ
    this.assertNotFlaggedForReview(queueItem);
    // กัน import ซ้ำเมื่อ link ค้างอยู่แต่ status ถูก reset กลับ (stale link case)
    this.assertNotAlreadyImported(queueItem);

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
    queueItem.reviewedBy = userId;
    queueItem.reviewedAt = new Date();
    // ADR-054 US3 (T026b, FR-008): durable audit link → correspondences.uuid
    // ของเอกสารที่ import สร้าง; queue row ต้อง retained (ลบได้เฉพาะ scoped delete)
    queueItem.importedCorrespondencePublicId =
      result.correspondencePublicId ?? null;
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

    // ADR-050: ดู assertNotFlaggedForReview — /approve เป็น commit path ที่ bypass ได้ก่อนหน้านี้
    this.assertNotFlaggedForReview(queueItem);
    // กัน import ซ้ำเมื่อ link ค้างอยู่แต่ status ถูก reset กลับ (stale link case)
    this.assertNotAlreadyImported(queueItem);

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
    queueItem.reviewedBy = userId;
    queueItem.reviewedAt = new Date();
    // ADR-054 US3 (T026b, FR-008): durable audit link → correspondences.uuid
    // ของเอกสารที่ import สร้าง; queue row ต้อง retained (ลบได้เฉพาะ scoped delete)
    queueItem.importedCorrespondencePublicId =
      result.correspondencePublicId ?? null;
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
    queueItem.reviewedBy = userId;
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
    queueItem.reviewedBy = userId;
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
   *
   * D330: ถ้า flat path ไม่พบไฟล์ ให้ค้นหาแบบ recursive ใน allowedRoots (bounded depth 5)
   * สำหรับรองรับข้อมูลที่ storageTempPath เก็บแค่ filename ไม่มี subdirectory (ADR-054 D1)
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

    // Bare filename (ไม่มี directory component) จะ resolve ไปที่ cwd เสมอ →
    // อยู่นอก allowed roots โดยนิยาม แต่ไม่ใช่ traversal — ให้ข้ามไปหา
    // D330 recursive search ได้เลย (รองรับ storageTempPath ที่เก็บแค่ชื่อไฟล์)
    const isBareName =
      filePath === path.basename(filePath) && !filePath.includes('..');

    if (!isWithinAllowed && !isBareName) {
      this.logger.warn(
        `Path traversal blocked: "${filePath}" resolves outside allowed dirs [${allowedRoots.join(', ')}]`
      );
      throw new ValidationException(
        'Invalid staging file path — access denied (path traversal guard)'
      );
    }

    if (isWithinAllowed && existsSync(resolvedPath)) {
      return createReadStream(resolvedPath);
    }

    // D330: Fallback recursive search สำหรับข้อมูลที่ storageTempPath เก็บแค่ filename
    // ค้นหาใน allowedRoots แบบ bounded depth 5 ระดับ
    const fileName = path.basename(resolvedPath);
    for (const root of allowedRoots) {
      const found = this.findFileRecursive(root, fileName, 5);
      if (found) {
        this.logger.log(
          `D330: Resolved staging file via recursive search: ${found}`
        );
        return createReadStream(found);
      }
    }

    throw new NotFoundException('File', filePath);
  }

  /**
   * D330: ค้นหาไฟล์แบบ recursive (bounded depth) — case-insensitive
   * ใช้สำหรับค้นหา PDF ใน subdirectory ของ staging/legacyNasPath
   * @param rootDir โฟลเดอร์เริ่มต้น
   * @param fileName ชื่อไฟล์เป้าหมาย (case-insensitive)
   * @param maxDepth ความลึกสูงสุด (default 5)
   * @returns full path ถ้าพบ, null ถ้าไม่พบ
   */
  private findFileRecursive(
    rootDir: string,
    fileName: string,
    maxDepth: number = 5
  ): string | null {
    if (maxDepth < 0) return null;
    const lowerTarget = fileName.toLowerCase();

    try {
      if (!existsSync(rootDir)) return null;
      const entries = readdirSync(rootDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(rootDir, entry.name);

        if (entry.isFile() && entry.name.toLowerCase() === lowerTarget) {
          return fullPath;
        }

        if (entry.isDirectory() && maxDepth > 0) {
          const found = this.findFileRecursive(
            fullPath,
            fileName,
            maxDepth - 1
          );
          if (found) return found;
        }
      }
    } catch {
      // ข้าม directory ที่อ่านไม่ได้
    }

    return null;
  }

  /** Compute SHA-256 checksum ของไฟล์แบบ streaming (สำหรับ migration attachments ที่ไม่มี checksum) */
  private async computeFileChecksum(filePath: string): Promise<string | null> {
    try {
      if (!existsSync(filePath)) {
        this.logger.warn(`computeFileChecksum: file not found: ${filePath}`);
        return null;
      }
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      for await (const chunk of stream) {
        hash.update(chunk as Buffer);
      }
      return hash.digest('hex');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`computeFileChecksum: failed for ${filePath}: ${msg}`);
      return null;
    }
  }
}
