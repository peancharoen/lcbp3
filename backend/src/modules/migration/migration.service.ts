import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private readonly dataSource: DataSource,
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
  ) {}

  async importCorrespondence(
    dto: ImportCorrespondenceDto,
    idempotencyKey: string,
    userId: number
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    // 1. Idempotency Check
    const existingTransaction = await this.importTransactionRepo.findOne({
      where: { idempotencyKey },
    });

    if (existingTransaction) {
      if (existingTransaction.statusCode === 201) {
        this.logger.log(
          `Idempotency key ${idempotencyKey} already processed. Returning cached success.`
        );
        return {
          message: 'Already processed',
          transaction: existingTransaction,
        };
      } else {
        throw new ConflictException(
          `Transaction failed previously with status ${existingTransaction.statusCode}`
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
      throw new BadRequestException(
        `Category "${dto.category}" not found in system.`
      );
    }

    // Default status for correspondence
    let status = await this.correspondenceStatusRepo.findOne({
      where: { statusCode: 'CLBOWN' },
    });
    if (!status) {
      status = await this.correspondenceStatusRepo.findOne({
        where: { statusCode: 'DRAFT' },
      });
    }
    if (!status) {
      throw new InternalServerErrorException(
        'CRITICAL: No default correspondence status found (missing CLBOWN/DRAFT)'
      );
    }

    // We now use project_id from n8n (instead of hardcoding LCBP3)
    const project = await this.projectRepo.findOne({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new BadRequestException(
        `Project ID ${dto.projectId} not found in database`
      );
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
          // Default RFA type generic mapping
          const rfaTypeRes = await queryRunner.manager.query<{ id: number }[]>(
            "SELECT id FROM rfa_types WHERE type_code = 'GEN' LIMIT 1"
          );
          const rfa = queryRunner.manager.create(Rfa, {
            id: correspondence.id,
            rfaTypeId: rfaTypeRes[0]?.id || 1, // fallback to id 1
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
      const revisionCount = await queryRunner.manager.count(
        CorrespondenceRevision,
        {
          where: { correspondenceId: correspondence.id },
        }
      );

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
        // Map Status code to RFA Equivalent 'APP' (Approved) if exist, or id 3 (typically Approved)
        const rfaStatusRes = await queryRunner.manager.query<{ id: number }[]>(
          "SELECT id FROM rfa_status_codes WHERE status_code = 'APP' LIMIT 1"
        );

        const rfaRev = queryRunner.manager.create(RfaRevision, {
          id: revision.id,
          rfaStatusCodeId: rfaStatusRes[0]?.id || 3, // Fallback to 3 if APP not found
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
        statusCode: 201,
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

      throw new InternalServerErrorException(
        'Migration import failed: ' + errorMessage
      );
    } finally {
      await queryRunner.release();
    }
  }

  async enqueueRecord(dto: EnqueueMigrationDto) {
    if (!dto.documentNumber) {
      throw new BadRequestException('documentNumber is required');
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

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getQueueItemById(id: number) {
    const item = await this.reviewQueueRepo.findOne({ where: { id } });
    if (!item) {
      throw new BadRequestException(`Queue item with ID ${id} not found`);
    }
    return item;
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
      throw new BadRequestException(`Queue item ${id} not found`);
    }

    if (queueItem.status !== MigrationReviewStatus.PENDING) {
      throw new BadRequestException(
        `Queue item ${id} is already ${queueItem.status}`
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

  async commitBatch(
    dto: CommitBatchDto,
    idempotencyKey: string,
    userId: number
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
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
      throw new BadRequestException('Queue item not found');
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

  getStagingFileStream(filePath: string) {
    if (!filePath) {
      throw new BadRequestException('File path is required');
    }

    const resolvedPath = path.resolve(filePath);
    if (!existsSync(resolvedPath)) {
      throw new BadRequestException('File not found at specified path');
    }

    return createReadStream(resolvedPath);
  }
}
