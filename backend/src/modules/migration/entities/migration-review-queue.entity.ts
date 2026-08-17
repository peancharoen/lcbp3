// File: backend/src/modules/migration/entities/migration-review-queue.entity.ts
// Change Log:
// - 2026-05-22: เพิ่มฟิลด์ aiJobId สำหรับเก็บ jobId ของ BullMQ (ADR-028)
// - 2026-08-06: เพิ่ม tempAttachmentIds (JSON), compareStatus (enum), compareUnavailableReason สำหรับ Feature 242 (FR-001, FR-002, FR-012a, FR-012b)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';

export enum MigrationReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  IMPORTED = 'IMPORTED',
  REJECTED = 'REJECTED',
}

/** สถานะการเปรียบเทียบทะเบียนกับเอกสารจริง (FR-012a) */
export enum CompareStatus {
  COMPARED = 'COMPARED',
  UNAVAILABLE = 'UNAVAILABLE',
}

@Entity('migration_review_queue')
export class MigrationReviewQueue extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'document_number', length: 100, unique: true })
  documentNumber!: string;

  @Column({ type: 'text', nullable: true })
  subject?: string;

  @Column({ name: 'original_subject', type: 'text', nullable: true })
  originalSubject?: string;

  @Column({ type: 'text', nullable: true })
  body?: string;

  @Column({ name: 'ai_suggested_category', length: 50, nullable: true })
  aiSuggestedCategory?: string;

  @Column({
    name: 'ai_confidence',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  aiConfidence?: number;

  @Column({ name: 'ai_issues', type: 'json', nullable: true })
  aiIssues?: Record<string, unknown>[];

  @Column({ name: 'review_reason', length: 255, nullable: true })
  reviewReason?: string;

  @Column({
    type: 'enum',
    enum: MigrationReviewStatus,
    default: MigrationReviewStatus.PENDING,
  })
  status!: MigrationReviewStatus;

  @Column({ name: 'reviewed_by', length: 100, nullable: true })
  reviewedBy?: string;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'project_id', type: 'int', nullable: true })
  projectId?: number;

  @Column({ name: 'sender_organization_id', type: 'int', nullable: true })
  senderOrganizationId?: number;

  @Column({ name: 'receiver_organization_id', type: 'int', nullable: true })
  receiverOrganizationId?: number;

  @Column({ name: 'received_date', type: 'date', nullable: true })
  receivedDate?: Date;

  @Column({ name: 'issued_date', type: 'date', nullable: true })
  issuedDate?: Date;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary?: string;

  @Column({ name: 'extracted_tags', type: 'json', nullable: true })
  extractedTags?: Record<string, string>[];

  /** Feature 242: JSON metadata เก็บ compareResult, capturedThresholds, attachments[] (FR-005, FR-007, FR-010c) */
  @Column({ name: 'ai_metadata_json', type: 'json', nullable: true })
  details?: Record<string, unknown> | null;

  /** @deprecated ใช้ tempAttachmentIds แทน — retained for backward compatibility (R4) */
  @Column({ name: 'temp_attachment_id', type: 'int', nullable: true })
  @Exclude()
  tempAttachmentId?: number;

  /**
   * รายการ internal attachment IDs หลายไฟล์ (FR-001, FR-002)
   * element [0] คือเอกสารหลัก (is_main_document=1)
   * @Exclude เพราะเป็น internal INT id ไม่ expose ใน API (ADR-019)
   */
  @Column({ name: 'temp_attachment_ids', type: 'json', nullable: true })
  @Exclude()
  tempAttachmentIds?: number[] | null;

  /** สถานะการเปรียบเทียบทะเบียนกับเอกสารจริง (FR-012a) */
  @Column({
    name: 'compare_status',
    type: 'enum',
    enum: CompareStatus,
    default: CompareStatus.COMPARED,
  })
  compareStatus!: CompareStatus;

  /** เหตุผลภาษาไทยเมื่อ compareStatus = UNAVAILABLE (FR-012b) */
  @Column({
    name: 'compare_unavailable_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  compareUnavailableReason?: string | null;

  @Column({ name: 'ai_job_id', type: 'varchar', length: 36, nullable: true })
  aiJobId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
