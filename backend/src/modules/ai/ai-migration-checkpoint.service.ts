// File: src/modules/ai/ai-migration-checkpoint.service.ts
// Change Log:
// - 2026-05-23: สร้าง service จัดการ Migration Checkpoint, Queue และ Error log ผ่าน API (ADR-023A)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  MigrationProgress,
  MigrationProgressStatus,
} from './entities/migration-progress.entity';
import {
  MigrationReviewRecord,
  MigrationReviewRecordStatus,
} from './entities/migration-review.entity';
import {
  MigrationErrorLogDto,
  MigrationQueueRecordDto,
  SaveCheckpointDto,
} from './dto/migration-checkpoint.dto';

/** Response DTO สำหรับ Checkpoint */
export interface CheckpointResponse {
  batchId: string;
  lastProcessedIndex: number;
  status: MigrationProgressStatus;
  updatedAt: Date | null;
}

@Injectable()
export class AiMigrationCheckpointService {
  private readonly logger = new Logger(AiMigrationCheckpointService.name);

  constructor(
    @InjectRepository(MigrationProgress)
    private readonly progressRepo: Repository<MigrationProgress>,
    @InjectRepository(MigrationReviewRecord)
    private readonly reviewRepo: Repository<MigrationReviewRecord>,
    private readonly dataSource: DataSource
  ) {}

  /**
   * ดึง Checkpoint ปัจจุบันของ Batch — ถ้ายังไม่มีให้คืนค่า default
   */
  async getCheckpoint(batchId: string): Promise<CheckpointResponse> {
    const record = await this.progressRepo.findOne({ where: { batchId } });
    if (!record) {
      return {
        batchId,
        lastProcessedIndex: 0,
        status: MigrationProgressStatus.RUNNING,
        updatedAt: null,
      };
    }
    return {
      batchId: record.batchId,
      lastProcessedIndex: record.lastProcessedIndex,
      status: record.status,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * บันทึกหรืออัพเดต Checkpoint ของ Batch (Upsert)
   */
  async saveCheckpoint(dto: SaveCheckpointDto): Promise<CheckpointResponse> {
    const existing = await this.progressRepo.findOne({
      where: { batchId: dto.batchId },
    });

    const record =
      existing ?? this.progressRepo.create({ batchId: dto.batchId });
    record.lastProcessedIndex = dto.lastProcessedIndex;
    record.status = dto.status ?? MigrationProgressStatus.RUNNING;

    const saved = await this.progressRepo.save(record);
    this.logger.log(
      `Checkpoint saved — batchId=${dto.batchId} index=${dto.lastProcessedIndex}`
    );
    return {
      batchId: saved.batchId,
      lastProcessedIndex: saved.lastProcessedIndex,
      status: saved.status,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * บันทึกรายการเข้า Review Queue (Upsert โดยใช้ idempotencyKey)
   */
  async upsertQueueRecord(
    dto: MigrationQueueRecordDto
  ): Promise<{ publicId: string }> {
    const idempotencyKey =
      dto.idempotencyKey ?? `${dto.batchId}:${dto.documentNumber}`;

    const existing = await this.reviewRepo.findOne({
      where: { idempotencyKey },
    });

    const record = existing ?? this.reviewRepo.create({ idempotencyKey });

    record.batchId = dto.batchId;
    record.originalFileName = dto.documentNumber;
    record.tempAttachmentId = dto.tempAttachmentId ?? undefined;
    record.confidenceScore = dto.confidence ?? undefined;
    record.status =
      dto.status === 'PENDING_REVIEW'
        ? MigrationReviewRecordStatus.PENDING_REVIEW
        : MigrationReviewRecordStatus.PENDING;
    record.errorReason = dto.reviewReason ?? undefined;
    record.extractedMetadata = {
      documentNumber: dto.documentNumber,
      subject: dto.subject,
      originalSubject: dto.originalSubject,
      ...(dto.aiResult ?? {}),
    };

    const saved = await this.reviewRepo.save(record);
    this.logger.log(
      `Queue record upserted — batchId=${dto.batchId} doc=${dto.documentNumber} status=${dto.status}`
    );
    return { publicId: saved.publicId };
  }

  /**
   * บันทึก Error Log สำหรับเอกสารที่ประมวลผลไม่สำเร็จ
   */
  async logError(dto: MigrationErrorLogDto): Promise<{ id: number }> {
    const result = await this.dataSource.query<{ insertId: number }[]>(
      `INSERT INTO migration_errors (batch_id, document_number, error_type, error_message, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        dto.batchId,
        dto.documentNumber,
        dto.errorType ?? 'UNKNOWN',
        dto.errorMessage ?? '',
      ]
    );
    this.logger.warn(
      `Error logged — batchId=${dto.batchId} doc=${dto.documentNumber} type=${dto.errorType}`
    );
    return { id: result[0]?.insertId ?? 0 };
  }
}
