// File: src/modules/ai/entities/migration-review.entity.ts
// Change Log
// - 2026-05-14: เพิ่ม entity staging queue สำหรับ Unified AI Architecture.
// - 2026-05-15: เพิ่ม column สำหรับ ADR-023A migration_review_queue schema.
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';

export enum MigrationReviewRecordStatus {
  PENDING = 'PENDING',
  IMPORTED = 'IMPORTED',
  REJECTED = 'REJECTED',
}

/** รายการเอกสารเก่าที่รอ human-in-the-loop validation ก่อน commit */
@Entity('migration_review_queue')
export class MigrationReviewRecord extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('idx_migration_review_batch')
  @Column({ name: 'batch_id', type: 'varchar', length: 100 })
  batchId!: string;

  @Index('uq_migration_review_idempotency', { unique: true })
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  idempotencyKey?: string;

  @Column({ name: 'original_file_name', type: 'varchar', length: 255 })
  originalFileName!: string;

  @Column({
    name: 'original_filename',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  originalFilename?: string;

  @Column({
    name: 'storage_temp_path',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  storageTempPath?: string;

  @Column({ name: 'source_attachment_public_id', type: 'uuid', nullable: true })
  sourceAttachmentPublicId?: string;

  @Column({ name: 'temp_attachment_id', type: 'int', nullable: true })
  tempAttachmentId?: number;

  @Column({ name: 'extracted_metadata', type: 'json', nullable: true })
  extractedMetadata?: Record<string, unknown>;

  @Column({ name: 'ai_metadata_json', type: 'json', nullable: true })
  aiMetadataJson?: Record<string, unknown>;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  confidenceScore?: number;

  @Column({ name: 'ocr_used', type: 'boolean', default: false })
  ocrUsed!: boolean;

  @Index('idx_migration_review_status')
  @Column({
    type: 'enum',
    enum: MigrationReviewRecordStatus,
    default: MigrationReviewRecordStatus.PENDING,
  })
  status!: MigrationReviewRecordStatus;

  @Column({ name: 'error_reason', type: 'text', nullable: true })
  errorReason?: string;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewedBy?: number;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt?: Date;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rejectionReason?: string;

  @VersionColumn({ name: 'version' })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
