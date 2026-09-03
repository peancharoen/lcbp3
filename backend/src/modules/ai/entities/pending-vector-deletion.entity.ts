// File: backend/src/modules/ai/entities/pending-vector-deletion.entity.ts
// Change Log:
// - 2026-09-03: Create entity for pending_vector_deletions table — compensation pattern
//   สำหรับ hardDelete() เมื่อ Qdrant sync deletion ล้มเหลว เก็บไว้ retry ภายหลัง

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** สถานะของ pending vector deletion */
export enum PendingVectorDeletionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Entity สำหรับตาราง pending_vector_deletions
 * เก็บคำสั่งลบ Qdrant vectors ที่ยังไม่สำเร็จจาก hardDelete()
 * Periodic cleanup job (VectorCleanupService) สแกนและ retry จนสำเร็จหรือถึง max_retries
 */
@Entity('pending_vector_deletions')
export class PendingVectorDeletion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true })
  publicId!: string;

  @Index('idx_pvd_doc')
  @Column({ name: 'document_public_id', type: 'varchar', length: 64 })
  documentPublicId!: string;

  @Index('idx_pvd_project')
  @Column({ name: 'project_public_id', type: 'varchar', length: 64 })
  projectPublicId!: string;

  @Index('idx_pvd_status')
  @Column({
    type: 'enum',
    enum: PendingVectorDeletionStatus,
    default: PendingVectorDeletionStatus.PENDING,
  })
  status!: PendingVectorDeletionStatus;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'max_retries', type: 'int', default: 10 })
  maxRetries!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'requested_by_user_id', type: 'int', nullable: true })
  requestedByUserId?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;
}
