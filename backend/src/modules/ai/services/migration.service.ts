// File: backend/src/modules/ai/services/migration.service.ts
// บันทึกการแก้ไข: สร้าง MigrationService สำหรับ Legacy Migration (T030) ตาม ADR-023A

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  MigrationReviewRecord,
  MigrationReviewRecordStatus,
} from '../entities/migration-review.entity';
import { MigrationQueueItemDto } from '../dto/migration-queue-item.dto';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectRepository(MigrationReviewRecord)
    private readonly migrationRepo: Repository<MigrationReviewRecord>,
    @InjectQueue('ai-batch')
    private readonly aiBatchQueue: Queue,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Queue a legacy document for human review and AI extraction
   */
  async queueForReview(dto: MigrationQueueItemDto, idempotencyKey: string) {
    this.logger.log(
      `📥 Queuing legacy document for review: ${dto.filename} (Batch: ${dto.batchId})`
    );

    // 1. Check idempotency
    const existing = await this.migrationRepo.findOne({
      where: { idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    // 2. Create pending record
    const record = this.migrationRepo.create({
      batchId: dto.batchId,
      idempotencyKey: idempotencyKey,
      originalFilename: dto.filename,
      storageTempPath: dto.tempPath,
      status: MigrationReviewRecordStatus.PENDING,
      aiMetadataJson: {}, // Will be updated by AI processor
      confidenceScore: 0,
    });

    const saved = await this.migrationRepo.save(record);

    // 3. Queue AI processing (OCR + Metadata Extraction)
    await this.aiBatchQueue.add('extract-metadata', {
      migrationQueuePublicId: saved.publicId,
      tempPath: dto.tempPath,
      filename: dto.filename,
      projectPublicId: dto.projectPublicId,
    });

    return saved;
  }

  /**
   * Get all migration queue items with pagination
   */
  async findAll(page = 1, limit = 20, status?: string) {
    const query = this.migrationRepo
      .createQueryBuilder('q')
      .orderBy('q.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      query.andWhere('q.status = :status', { status });
    }

    const [items, total] = await query.getManyAndCount();
    return { items, total, page, limit };
  }

  /**
   * Approve a migration item and import it as a real document
   */
  async approve(publicId: string, user: User) {
    const item = await this.migrationRepo.findOne({ where: { publicId } });
    if (!item) throw new NotFoundException('Migration item not found');
    if (item.status !== MigrationReviewRecordStatus.PENDING)
      throw new BadRequestException(
        `Cannot approve item in status ${item.status}`
      );

    this.logger.log(
      `✅ Approving migration item: ${item.originalFilename} (uuid: ${publicId})`
    );

    // TODO: Implement actual document import logic here in US3 Phase 5
    // This will involve calling FileStorageService, CorrespondenceService, etc.

    item.status = MigrationReviewRecordStatus.IMPORTED;
    item.reviewedBy = user.user_id;
    item.reviewedAt = new Date();

    return this.migrationRepo.save(item);
  }

  /**
   * Reject a migration item
   */
  async reject(publicId: string, user: User, reason: string) {
    const item = await this.migrationRepo.findOne({ where: { publicId } });
    if (!item) throw new NotFoundException('Migration item not found');

    item.status = MigrationReviewRecordStatus.REJECTED;
    item.reviewedBy = user.user_id;
    item.reviewedAt = new Date();
    item.rejectionReason = reason;

    return this.migrationRepo.save(item);
  }
}
