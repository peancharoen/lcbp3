// File: src/modules/ai/ai-ingest.service.ts
// Change Log
// - 2026-05-14: เพิ่ม service สำหรับ Legacy Migration staging queue ตาม ADR-023.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { MigrationService } from '../migration/migration.service';
import {
  AiAuditLog,
  AiAuditStatus as AiStatus,
} from './entities/ai-audit-log.entity';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { AiQueueService } from './ai-queue.service';
import {
  ApproveLegacyMigrationDto,
  LegacyMigrationIngestDto,
  LegacyMigrationQueueQueryDto,
  LegacyMigrationRecordDto,
} from './dto/legacy-migration.dto';
import {
  MigrationReviewRecord,
  MigrationReviewRecordStatus,
} from './entities/migration-review.entity';

export interface MigrationReviewResponse {
  publicId: string;
  batchId: string;
  originalFileName: string;
  sourceAttachmentPublicId?: string;
  extractedMetadata?: Record<string, unknown>;
  confidenceScore?: number;
  status: MigrationReviewRecordStatus;
  errorReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedMigrationReviewResponse {
  items: MigrationReviewResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AiIngestService {
  private readonly logger = new Logger(AiIngestService.name);
  private readonly maxFileSize = 50 * 1024 * 1024;
  private readonly allowedMimeTypes = new Set<string>([
    'application/pdf',
    'application/x-pdf',
    'application/octet-stream',
  ]);

  constructor(
    private readonly configService: ConfigService,
    private readonly fileStorageService: FileStorageService,
    private readonly aiQueueService: AiQueueService,
    private readonly migrationService: MigrationService,
    @InjectRepository(MigrationReviewRecord)
    private readonly reviewRepo: Repository<MigrationReviewRecord>,
    @InjectRepository(AiAuditLog)
    private readonly auditLogRepo: Repository<AiAuditLog>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(CorrespondenceType)
    private readonly correspondenceTypeRepo: Repository<CorrespondenceType>
  ) {}

  async ingest(
    dto: LegacyMigrationIngestDto,
    files: Express.Multer.File[]
  ): Promise<{ batchId: string; queued: number; queueJobId?: string }> {
    const records = this.parseRecords(dto.records);
    const serviceUserId = this.getServiceUserId();
    const createdRecords: MigrationReviewRecord[] = [];
    const filePublicIds: string[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      this.validateFile(file);
      const attachment = await this.fileStorageService.upload(
        file,
        serviceUserId
      );
      const recordInput = this.matchRecord(records, file.originalname, index);
      filePublicIds.push(attachment.publicId);
      createdRecords.push(
        this.reviewRepo.create({
          batchId: dto.batchId,
          originalFileName: recordInput.originalFileName ?? file.originalname,
          sourceAttachmentPublicId: attachment.publicId,
          tempAttachmentId: attachment.id,
          extractedMetadata: recordInput.extractedMetadata,
          confidenceScore: recordInput.confidenceScore,
          status: this.deriveStatus(recordInput),
          errorReason: recordInput.errorReason,
        })
      );
    }

    if (files.length === 0) {
      for (const recordInput of records) {
        createdRecords.push(
          this.reviewRepo.create({
            batchId: dto.batchId,
            originalFileName:
              recordInput.originalFileName ?? `${dto.batchId}-record.json`,
            extractedMetadata: recordInput.extractedMetadata,
            confidenceScore: recordInput.confidenceScore,
            status: this.deriveStatus(recordInput),
            errorReason: recordInput.errorReason,
          })
        );
      }
    }

    if (createdRecords.length === 0) {
      throw new ValidationException('At least one file or record is required');
    }

    const saved = await this.reviewRepo.save(createdRecords);
    const queueJobId = await this.aiQueueService.enqueueIngest({
      batchId: dto.batchId,
      filePublicIds,
      source: dto.source === 'folder-watcher' ? 'folder-watcher' : 'api',
    });

    this.logger.log(
      `AI legacy migration batch ${dto.batchId} created ${saved.length} staging records`
    );

    return { batchId: dto.batchId, queued: saved.length, queueJobId };
  }

  async listQueue(
    query: LegacyMigrationQueueQueryDto
  ): Promise<PaginatedMigrationReviewResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.reviewRepo.createQueryBuilder('record');

    if (query.status) {
      qb.where('record.status = :status', { status: query.status });
    }

    qb.orderBy('record.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approve(
    publicId: string,
    dto: ApproveLegacyMigrationDto,
    idempotencyKey: string,
    userId: number
  ): Promise<{ record: MigrationReviewResponse; importResult: unknown }> {
    if (!idempotencyKey) {
      throw new ValidationException('Idempotency-Key header is required');
    }

    const record = await this.reviewRepo.findOne({ where: { publicId } });
    if (!record) {
      throw new NotFoundException('MigrationReviewRecord', publicId);
    }

    if (record.status !== MigrationReviewRecordStatus.PENDING) {
      throw new BusinessException(
        'AI_MIGRATION_RECORD_NOT_PENDING',
        `Migration review record ${publicId} is ${record.status}`,
        'รายการนี้ไม่อยู่ในสถานะรอตรวจสอบ',
        ['รีเฟรชรายการ staging queue', 'ตรวจสอบสถานะล่าสุดก่อนอนุมัติ']
      );
    }

    const project = await this.resolveProject(dto.projectPublicId);
    const correspondenceType = await this.resolveCorrespondenceType(
      dto.categoryCode
    );
    const sender = dto.senderOrganizationPublicId
      ? await this.resolveOrganization(dto.senderOrganizationPublicId)
      : undefined;
    const receiver = dto.receiverOrganizationPublicId
      ? await this.resolveOrganization(dto.receiverOrganizationPublicId)
      : undefined;

    const importResult = await this.migrationService.importCorrespondence(
      {
        documentNumber: dto.documentNumber,
        subject: dto.subject,
        category: correspondenceType.typeCode,
        migratedBy: 'AI_STAGING_APPROVAL',
        batchId: record.batchId,
        projectId: project.id,
        senderId: sender?.id,
        receiverId: receiver?.id,
        issuedDate: dto.issuedDate,
        receivedDate: dto.receivedDate,
        body: dto.body,
        tempAttachmentId: record.tempAttachmentId,
        aiConfidence:
          record.confidenceScore === undefined
            ? undefined
            : Number(record.confidenceScore),
        details: {
          aiSuggestion: record.extractedMetadata,
          humanOverride: dto.finalMetadata,
        },
      },
      idempotencyKey,
      userId
    );

    record.status = MigrationReviewRecordStatus.IMPORTED;
    record.extractedMetadata = {
      ...(record.extractedMetadata ?? {}),
      humanOverride: dto.finalMetadata ?? {},
    };
    const saved = await this.reviewRepo.save(record);

    // T025: บันทึก AuditLog เปรียบเทียบ AI suggestion กับ Human override (ADR-023)
    await this.saveApprovalAuditLog({
      documentPublicId: record.publicId,
      aiSuggestionJson: record.extractedMetadata,
      humanOverrideJson: (dto.finalMetadata as Record<string, unknown>) ?? {},
      confirmedByUserId: userId,
      confidenceScore:
        record.confidenceScore === undefined
          ? undefined
          : Number(record.confidenceScore),
    });

    return { record: this.toResponse(saved), importResult };
  }

  private parseRecords(
    records: LegacyMigrationIngestDto['records']
  ): LegacyMigrationRecordDto[] {
    if (!records) return [];
    if (Array.isArray(records)) return records;
    try {
      const parsed = JSON.parse(records) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('records must be an array');
      }
      return parsed as LegacyMigrationRecordDto[];
    } catch (error) {
      throw new ValidationException(
        `Invalid records payload: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private matchRecord(
    records: LegacyMigrationRecordDto[],
    originalFileName: string,
    index: number
  ): LegacyMigrationRecordDto {
    return (
      records.find((record) => record.originalFileName === originalFileName) ??
      records[index] ??
      {}
    );
  }

  private deriveStatus(
    record: LegacyMigrationRecordDto
  ): MigrationReviewRecordStatus {
    if (record.status) return record.status;
    if (record.errorReason) return MigrationReviewRecordStatus.REJECTED;
    if (
      record.confidenceScore !== undefined &&
      Number(record.confidenceScore) < 0.6
    ) {
      return MigrationReviewRecordStatus.REJECTED;
    }
    return MigrationReviewRecordStatus.PENDING;
  }

  private validateFile(file: Express.Multer.File): void {
    if (file.size > this.maxFileSize) {
      throw new ValidationException('File exceeds 50MB limit');
    }
    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new ValidationException(`Unsupported file type: ${file.mimetype}`);
    }
  }

  private getServiceUserId(): number {
    return this.configService.get<number>('AI_SERVICE_USER_ID') ?? 1;
  }

  private async resolveProject(publicId: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { publicId } });
    if (!project) throw new NotFoundException('Project', publicId);
    return project;
  }

  private async resolveOrganization(publicId: string): Promise<Organization> {
    const organization = await this.organizationRepo.findOne({
      where: { publicId },
    });
    if (!organization) throw new NotFoundException('Organization', publicId);
    return organization;
  }

  private async resolveCorrespondenceType(
    typeCode: string
  ): Promise<CorrespondenceType> {
    const type = await this.correspondenceTypeRepo.findOne({
      where: [{ typeCode }, { typeName: typeCode }],
    });
    if (!type) throw new NotFoundException('CorrespondenceType', typeCode);
    return type;
  }

  /** T025: บันทึก AuditLog สำหรับการอนุมัติ Human-in-the-loop (ADR-023 Rule 5) */
  private async saveApprovalAuditLog(data: {
    documentPublicId: string;
    aiSuggestionJson?: Record<string, unknown>;
    humanOverrideJson: Record<string, unknown>;
    confirmedByUserId: number;
    confidenceScore?: number;
  }): Promise<void> {
    try {
      const log = this.auditLogRepo.create({
        documentPublicId: data.documentPublicId,
        aiModel: 'legacy-migration',
        status: AiStatus.SUCCESS,
        aiSuggestionJson: data.aiSuggestionJson,
        humanOverrideJson: data.humanOverrideJson,
        confirmedByUserId: data.confirmedByUserId,
        confidenceScore: data.confidenceScore,
      });
      await this.auditLogRepo.save(log);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to save approval audit log for ${data.documentPublicId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private toResponse(record: MigrationReviewRecord): MigrationReviewResponse {
    return {
      publicId: record.publicId,
      batchId: record.batchId,
      originalFileName: record.originalFileName,
      sourceAttachmentPublicId: record.sourceAttachmentPublicId,
      extractedMetadata: record.extractedMetadata,
      confidenceScore:
        record.confidenceScore === undefined
          ? undefined
          : Number(record.confidenceScore),
      status: record.status,
      errorReason: record.errorReason,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
