// File: src/modules/ai/ai-migration-checkpoint.service.ts
// Change Log:
// - 2026-05-23: สร้าง service จัดการ Migration Checkpoint, Queue และ Error log ผ่าน API (ADR-023A)
// - 2026-05-24: เพิ่มฟังก์ชันค้นหาและแปลง UUID เป็นตัวเลข ID จริงใน upsertQueueRecord เพื่อป้องกันการเขียนทับด้วย undefined
// - 2026-05-24: Normalize migration error type และบันทึก jobId เพื่อป้องกัน DB enum reject

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

type MigrationErrorTypeValue =
  | 'FILE_NOT_FOUND'
  | 'MISSING_FILENAME'
  | 'FILE_ERROR'
  | 'AI_PARSE_ERROR'
  | 'API_ERROR'
  | 'DB_ERROR'
  | 'SECURITY'
  | 'UNKNOWN';

const MIGRATION_ERROR_TYPE_MAP: Readonly<
  Record<string, MigrationErrorTypeValue>
> = {
  AI_JOB_FAILED: 'API_ERROR',
  PARSE_ERROR: 'AI_PARSE_ERROR',
  TOKEN_EXPIRED: 'API_ERROR',
};

const MIGRATION_ERROR_TYPES = new Set<MigrationErrorTypeValue>([
  'FILE_NOT_FOUND',
  'MISSING_FILENAME',
  'FILE_ERROR',
  'AI_PARSE_ERROR',
  'API_ERROR',
  'DB_ERROR',
  'SECURITY',
  'UNKNOWN',
]);

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
    if (dto.tempAttachmentId) {
      if (typeof dto.tempAttachmentId === 'number') {
        record.tempAttachmentId = dto.tempAttachmentId;
      } else {
        const rows = await this.dataSource.manager.query<{ id: number }[]>(
          'SELECT id FROM attachments WHERE uuid = ? LIMIT 1',
          [dto.tempAttachmentId]
        );
        if (rows && rows.length > 0) {
          record.tempAttachmentId = rows[0].id;
        }
      }
    }
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
    const errorType = this.normalizeMigrationErrorType(dto.errorType);
    const result = await this.dataSource.query<{ insertId: number }[]>(
      `INSERT INTO migration_errors (batch_id, document_number, error_type, error_message, job_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        dto.batchId,
        dto.documentNumber,
        errorType,
        dto.errorMessage ?? '',
        dto.jobId ?? null,
      ]
    );
    this.logger.warn(
      `Error logged — batchId=${dto.batchId} doc=${dto.documentNumber} type=${errorType}`
    );
    return { id: result[0]?.insertId ?? 0 };
  }

  /** แปลง error_type จาก workflow ให้ตรง enum ของ migration_errors */
  private normalizeMigrationErrorType(
    errorType?: string
  ): MigrationErrorTypeValue {
    const mappedType = errorType
      ? (MIGRATION_ERROR_TYPE_MAP[errorType] ?? errorType)
      : 'UNKNOWN';
    return MIGRATION_ERROR_TYPES.has(mappedType) ? mappedType : 'UNKNOWN';
  }
}
