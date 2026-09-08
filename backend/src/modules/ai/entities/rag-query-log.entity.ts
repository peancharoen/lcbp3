// File: backend/src/modules/ai/entities/rag-query-log.entity.ts
// Change Log:
// - 2026-09-08: Create entity for ai_rag_query_logs table — persistent RAG query logging.
//   AiRagService.processQuery() previously only wrote results to Redis (300s TTL), leaving
//   no durable data to evaluate proposed retrieval changes (ES fusion, summary-index routing).

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/** สถานะ terminal ของ RAG query — ไม่รวม cancelled (user-abort signal ไม่ใช่ retrieval-quality signal) */
export enum RagQueryLogStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Entity สำหรับตาราง ai_rag_query_logs
 * บันทึกประวัติ RAG query แบบถาวรทุกครั้งที่ processQuery() ถึง terminal state
 */
@Entity('ai_rag_query_logs')
export class RagQueryLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true })
  publicId!: string;

  @Column({ name: 'project_public_id', type: 'uuid' })
  projectPublicId!: string;

  @Column({ name: 'user_public_id', type: 'uuid', nullable: true })
  userPublicId?: string;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'text', nullable: true })
  answer?: string;

  @Column({ type: 'enum', enum: RagQueryLogStatus })
  status!: RagQueryLogStatus;

  @Column({ name: 'confidence_score', type: 'float', nullable: true })
  confidenceScore?: number;

  @Column({
    name: 'used_fallback_model',
    type: 'tinyint',
    width: 1,
    default: 0,
  })
  usedFallbackModel!: boolean;

  @Column({ name: 'citations_json', type: 'json', nullable: true })
  citationsJson?: unknown;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'processing_time_ms', type: 'int', nullable: true })
  processingTimeMs?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
