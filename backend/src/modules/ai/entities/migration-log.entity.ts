// File: src/modules/ai/entities/migration-log.entity.ts
// Entity สำหรับตาราง migration_logs — ติดตาม AI Processing ของแต่ละเอกสาร (ADR-020)

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';

// สถานะของ Migration Log ตาม State Machine ใน ADR-020
export enum MigrationLogStatus {
  PENDING_REVIEW = 'PENDING_REVIEW', // รอ Admin ตรวจสอบ
  VERIFIED = 'VERIFIED', // Admin ตรวจสอบแล้ว ยืนยันถูกต้อง
  IMPORTED = 'IMPORTED', // นำเข้าระบบสำเร็จ (Terminal State)
  FAILED = 'FAILED', // ล้มเหลว สามารถ retry ได้
}

// Transition Rules: ห้าม import โดยตรงจาก FAILED หรือ PENDING ไปยัง IMPORTED
export const MIGRATION_STATUS_TRANSITIONS: Record<
  MigrationLogStatus,
  MigrationLogStatus[]
> = {
  [MigrationLogStatus.PENDING_REVIEW]: [
    MigrationLogStatus.VERIFIED,
    MigrationLogStatus.FAILED,
  ],
  [MigrationLogStatus.VERIFIED]: [
    MigrationLogStatus.IMPORTED,
    MigrationLogStatus.PENDING_REVIEW,
  ],
  [MigrationLogStatus.IMPORTED]: [], // Terminal State — ไม่สามารถเปลี่ยนได้
  [MigrationLogStatus.FAILED]: [MigrationLogStatus.PENDING_REVIEW], // Retry ได้
};

@Entity('migration_logs')
export class MigrationLog extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // ไฟล์ต้นทางที่นำเข้า (path หรือ filename)
  @Column({ name: 'source_file', type: 'varchar', length: 255 })
  sourceFile!: string;

  // Metadata จากแหล่งข้อมูลต้นทาง (Excel, manual input)
  @Column({ name: 'source_metadata', type: 'json', nullable: true })
  sourceMetadata?: Record<string, unknown>;

  // Metadata ที่ AI สกัดได้จากเอกสาร
  @Column({ name: 'ai_extracted_metadata', type: 'json', nullable: true })
  aiExtractedMetadata?: Record<string, unknown>;

  // คะแนนความมั่นใจของ AI (0.00-1.00)
  @Index('idx_migration_logs_confidence')
  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  confidenceScore?: number;

  // สถานะปัจจุบันของ Migration Log
  @Index('idx_migration_logs_status')
  @Column({
    type: 'enum',
    enum: MigrationLogStatus,
    default: MigrationLogStatus.PENDING_REVIEW,
  })
  status!: MigrationLogStatus;

  // ความเห็นของ Admin ผู้ตรวจสอบ
  @Column({ name: 'admin_feedback', type: 'text', nullable: true })
  adminFeedback?: string;

  // User ID ของ Admin ที่ตรวจสอบ (Internal INT, ไม่ expose ใน API)
  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewedBy?: number;

  // เวลาที่ตรวจสอบ
  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
