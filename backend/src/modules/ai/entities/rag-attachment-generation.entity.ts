// File: backend/src/modules/ai/entities/rag-attachment-generation.entity.ts
// Change Log:
// - 2026-09-09: เพิ่ม entity สำหรับ lifecycle ของ RAG Attachment generation (Feature 254)

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Entity สำหรับ generation ที่ผูกกับ checksum ของ Attachment หนึ่งไฟล์ */
@Entity('rag_attachment_generations')
@Index('idx_rag_generation_attachment', ['attachmentUuid'])
@Index('idx_rag_generation_status', ['status'])
@Index('idx_rag_generation_failed', ['status', 'failedAt'])
export class RagAttachmentGeneration {
  @PrimaryColumn({ name: 'generation_uuid', type: 'uuid' })
  generationUuid!: string;

  @Column({ name: 'attachment_uuid', type: 'uuid' })
  attachmentUuid!: string;

  @Column({ name: 'attachment_checksum_snapshot', length: 64 })
  attachmentChecksumSnapshot!: string;

  @Column({ name: 'verified_content_checksum', length: 64, nullable: true })
  verifiedContentChecksum?: string;

  @Column({
    type: 'enum',
    enum: ['BUILDING', 'ACTIVE', 'RETIRED', 'FAILED'],
    default: 'BUILDING',
  })
  status!: 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';

  @Column({ name: 'embedding_model', length: 100, default: 'bge-m3' })
  embeddingModel!: string;

  @Column({ name: 'embedding_model_version', length: 100, nullable: true })
  embeddingModelVersion?: string;

  @Column({ name: 'embedding_schema', type: 'json', nullable: true })
  embeddingSchema?: Record<string, unknown>;

  @Column({ name: 'error_code', length: 100, nullable: true })
  errorCode?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at', precision: 3 })
  createdAt!: Date;

  @Column({
    name: 'activated_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  activatedAt?: Date;

  @Column({
    name: 'retired_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  retiredAt?: Date;

  @Column({ name: 'failed_at', type: 'datetime', precision: 3, nullable: true })
  failedAt?: Date;
}
