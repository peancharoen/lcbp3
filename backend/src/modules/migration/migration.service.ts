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
import { ImportTransaction } from './entities/import-transaction.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { Project } from '../project/entities/project.entity';
import { FileStorageService } from '../../common/file-storage/file-storage.service';

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
    const type = await this.correspondenceTypeRepo.findOne({
      where: { typeName: dto.category },
    });

    // If exact name isn't found, try typeCode just in case
    const typeId = type
      ? type.id
      : (
          await this.correspondenceTypeRepo.findOne({
            where: { typeCode: dto.category },
          })
        )?.id;

    if (!typeId) {
      throw new BadRequestException(
        `Category "${dto.category}" not found in system.`
      );
    }

    // Migrate documents typically end up as 'Closed by Owner' or a similar terminal state, unless specifically pending.
    // For legacy, let's use a default terminal status 'CLBOWN' if available. If not, fallback to 'DRAFT'.
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

    // We assume migration runs for LCBP3 project
    const project = await this.projectRepo.findOne({
      where: { projectCode: 'LCBP3' },
    });
    if (!project) {
      throw new InternalServerErrorException(
        'Project LCBP3 not found in database'
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. Find or Create Correspondence
      let correspondence = await queryRunner.manager.findOne(Correspondence, {
        where: {
          correspondenceNumber: dto.document_number,
          projectId: project.id,
        },
      });

      if (!correspondence) {
        correspondence = queryRunner.manager.create(Correspondence, {
          correspondenceNumber: dto.document_number,
          correspondenceTypeId: typeId,
          projectId: project.id,
          isInternal: false,
          createdBy: userId,
        });
        await queryRunner.manager.save(correspondence);
      }

      // 4. File Handling
      // We will map the source file and create an Attachment record using FileStorageService
      // For legacy migrations, we pass document_number mapping logic or basic processing
      let attachmentId: number | null = null;
      if (dto.source_file_path) {
        try {
          const attachment = await this.fileStorageService.importStagingFile(
            dto.source_file_path,
            userId,
            { documentType: dto.category } // use category from DTO directly
          );
          attachmentId = attachment.id;
        } catch (fileError: unknown) {
          const errMsg =
            fileError instanceof Error ? fileError.message : String(fileError);

          this.logger.warn(
            `Failed to import file for [${dto.document_number}], continuing without attachment: ${errMsg}`
          );
        }
      }

      // 5. Create Revision
      const revisionCount = await queryRunner.manager.count(
        CorrespondenceRevision,
        {
          where: { correspondenceId: correspondence.id },
        }
      );

      // Determine revision number. Support mapping multiple batches to the same document number by incrementing revision.
      const revNum = revisionCount;
      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: correspondence.id,
        revisionNumber: revNum,
        revisionLabel: revNum === 0 ? '0' : revNum.toString(),
        isCurrent: true,
        statusId: status.id,
        subject: dto.title,
        description: 'Migrated from legacy system via Auto Ingest',
        details: {
          ...dto.details,
          ai_confidence: dto.ai_confidence,
          ai_issues: dto.ai_issues as unknown,
          source_file_path: dto.source_file_path,
          attachment_id: attachmentId, // Link attachment ID if successful
        },
        schemaVersion: 1,
        createdBy: userId, // Bot ID
      });

      if (revisionCount > 0) {
        await queryRunner.manager.update(
          CorrespondenceRevision,
          { correspondenceId: correspondence.id, isCurrent: true },
          { isCurrent: false }
        );
      }

      await queryRunner.manager.save(revision);

      // 5. Track Transaction
      const transaction = queryRunner.manager.create(ImportTransaction, {
        idempotencyKey,
        documentNumber: dto.document_number,
        batchId: dto.batch_id,
        statusCode: 201,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Ingested document [${dto.document_number}] successfully (Batch: ${dto.batch_id})`
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
        `Import failed for document [${dto.document_number}]: ${errorMessage}`,
        errorStack
      );

      const failedTransaction = this.importTransactionRepo.create({
        idempotencyKey,
        documentNumber: dto.document_number,
        batchId: dto.batch_id,
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
}
