// File: src/modules/ai/entities/ai-audit-log.entity.ts
// Entity สำหรับตาราง ai_audit_logs — บันทึก AI Interaction ทุกครั้งตาม ADR-018 Rule 5

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';

// สถานะการประมวลผลของ AI
export enum AiAuditStatus {
  SUCCESS = 'SUCCESS', // ประมวลผลสำเร็จ
  FAILED = 'FAILED', // ประมวลผลล้มเหลว
  TIMEOUT = 'TIMEOUT', // หมดเวลา
}

@Entity('ai_audit_logs')
export class AiAuditLog extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // UUID ของ MigrationLog ที่เกี่ยวข้อง (ใช้ UUID string ไม่ใช่ INT FK)
  @Index('idx_ai_audit_document')
  @Column({ name: 'document_public_id', type: 'uuid', nullable: true })
  documentPublicId?: string;

  // ชื่อ AI Model ที่ใช้ประมวลผล เช่น 'gemma4', 'paddleocr'
  @Index('idx_ai_audit_model')
  @Column({ name: 'ai_model', type: 'varchar', length: 50 })
  aiModel!: string;

  // เวลาประมวลผลเป็น milliseconds
  @Column({ name: 'processing_time_ms', type: 'int', nullable: true })
  processingTimeMs?: number;

  // คะแนนความมั่นใจของ AI (0.00-1.00)
  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  confidenceScore?: number;

  // SHA-256 hash ของ Input เพื่อ Audit Trail (ADR-018)
  @Column({ name: 'input_hash', type: 'varchar', length: 64, nullable: true })
  inputHash?: string;

  // SHA-256 hash ของ Output เพื่อ Audit Trail (ADR-018)
  @Column({ name: 'output_hash', type: 'varchar', length: 64, nullable: true })
  outputHash?: string;

  // สถานะการประมวลผล
  @Index('idx_ai_audit_status')
  @Column({
    type: 'enum',
    enum: AiAuditStatus,
  })
  status!: AiAuditStatus;

  // ข้อความ Error (ถ้ามี)
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
