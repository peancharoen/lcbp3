import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BusinessException,
  ConflictException,
  NotFoundException,
  SystemException,
  ValidationException,
} from '../../common/exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { EnqueueMigrationDto } from './dto/enqueue-migration.dto';
import { CommitBatchDto } from './dto/commit-batch.dto';
import { CreateMigrationErrorDto } from './dto/create-migration-error.dto';
import { ImportTransaction } from './entities/import-transaction.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { Project } from '../project/entities/project.entity';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
} from './entities/migration-review-queue.entity';
import { MigrationError } from './entities/migration-error.entity';
import { MigrationQueueQueryDto } from './dto/migration-queue-query.dto';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { createReadStream, existsSync } from 'fs';
import * as path from 'path';
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
    private readonly fileStorageService: FileStorageService
  ) {
    this.stagingDir =
      this.configService.get<string>(ENV_STAGING_DIR) || STAGING_DIR_FALLBACK;
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
          disciplineId: dto.disciplineId || undefined,
          originatorId: dto.senderId || undefined, // Set explicitly from DTO
          isInternal: false,
          createdBy: userId,
        });
        await queryRunner.manager.save(correspondence);

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
        if (dto.disciplineId && !correspondence.disciplineId) {
          correspondence.disciplineId = dto.disciplineId;
          hasChanges = true;
        }
        if (dto.senderId && !correspondence.originatorId) {
          correspondence.originatorId = dto.senderId;
          hasChanges = true;
        }
        if (hasChanges) {
          await queryRunner.manager.save(correspondence);
        }
      }

      // 4. File Handling
      let attachmentId: number | null = null;
      if (dto.tempAttachmentId) {
        attachmentId = dto.tempAttachmentId;
        try {
          // Mark attachment as permanent
          await queryRunner.manager.update(
            Attachment,
            { id: attachmentId },
            { isTemporary: false }
          );
        } catch (fileError: unknown) {
          const errMsg =
            fileError instanceof Error ? fileError.message : String(fileError);
          this.logger.warn(
            `Failed to update temp_file [id:${attachmentId}]: ${errMsg}`
          );
        }
      } else if (dto.sourceFilePath) {
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

      // 5. Create Revision
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
        subject: dto.subject,
        description: 'Migrated from legacy system via Auto Ingest',
        body: dto.body || undefined,
        documentDate: parseDateStr(dto.documentDate || dto.issuedDate),
        issuedDate: parseDateStr(dto.issuedDate),
        receivedDate: parseDateStr(dto.receivedDate),
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

      if (revisionCount > 0) {
        await queryRunner.manager.update(
          CorrespondenceRevision,
          { correspondenceId: correspondence.id, isCurrent: true },
          { isCurrent: false }
        );
      }

      await queryRunner.manager.save(revision);

      // --- CTI: insert RfaRevision ---
      if (isRFA) {
        // ADR-016: ห้าม fallback ค่า Master Data อัตโนมัติ — throw เพื่อ
        // ป้องกัน data corruption และบังคับให้ DBA ตรวจสอบ seed data
        const rfaStatusRes = await queryRunner.manager.query<{ id: number }[]>(
          'SELECT id FROM rfa_status_codes WHERE status_code = ? LIMIT 1',
          [RFA_STATUS_CODE_APPROVED]
        );
        if (!rfaStatusRes[0]?.id) {
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
          details: {
            // Keep drawingCount as 0 for migration stub
            drawingCount: 0,
          },
          schemaVersion: 1,
        });
        await queryRunner.manager.save(RfaRevision, rfaRev);
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

      this.logger.log(
        `Ingested document [${dto.documentNumber}] successfully (Batch: ${dto.batchId})`
      );

      return {
        message: 'Import successful',
        correspondenceId: correspondence.id,
        revisionId: revision.id,
        transactionId: transaction.id,
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

  async getReviewQueue(query: MigrationQueueQueryDto) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.reviewQueueRepo.createQueryBuilder('queue');
    if (status) {
      queryBuilder.where('queue.status = :status', { status });
    }

    queryBuilder.orderBy('queue.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    // Feature 242: enrich items with attachments[] metadata (FR-005)
    const enrichedItems = await this.enrichWithAttachments(items);

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
    const enriched = await this.enrichWithAttachments([item]);
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

    if (queueItem.status !== MigrationReviewStatus.PENDING) {
      throw new BusinessException(
        'MIGRATION_ITEM_NOT_PENDING',
        `Queue item ${id} is already ${queueItem.status}`,
        'รายการนี้ไม่อยู่ในสถานะ PENDING'
      );
    }

    // Attempt the import
    const result = await this.importCorrespondence(dto, idempotencyKey, userId);

    // If successful, update the queue item status
    queueItem.status = MigrationReviewStatus.APPROVED;
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

    if (queueItem.status !== MigrationReviewStatus.PENDING) {
      throw new BusinessException(
        'MIGRATION_ITEM_NOT_PENDING',
        `Queue item ${publicId} is already ${queueItem.status}`,
        'รายการนี้ไม่อยู่ในสถานะ PENDING'
      );
    }

    const result = await this.importCorrespondence(dto, idempotencyKey, userId);

    queueItem.status = MigrationReviewStatus.APPROVED;
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

    // We let each import have its own transaction via approveQueueItem
    // to avoid one bad record failing the entire batch of valid ones.

    for (const item of dto.items) {
      // Create a unique sub-key for each item to avoid idempotency conflicts
      // when using a batch idempotency key.
      const subKey = `${idempotencyKey}_${item.queueId}`;

      // Force batchId on the item dto
      item.dto.batchId = dto.batchId;

      try {
        const result = await this.approveQueueItem(
          item.queueId,
          item.dto,
          subKey,
          userId
        );
        results.push({ queueId: item.queueId, result });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({ queueId: item.queueId, error: errorMessage });
        this.logger.error(
          `Batch commit failed for queue ID ${item.queueId}: ${errorMessage}`
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
    const normalizedStaging = path.resolve(this.stagingDir);

    // Path Traversal Guard: resolvedPath ต้องอยู่ภายใต้ stagingDir
    if (
      resolvedPath !== normalizedStaging &&
      !resolvedPath.startsWith(normalizedStaging + path.sep)
    ) {
      this.logger.warn(
        `Path traversal blocked: "${filePath}" resolves outside staging dir "${normalizedStaging}"`
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
