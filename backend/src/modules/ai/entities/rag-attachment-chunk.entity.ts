// File: backend/src/modules/ai/entities/rag-attachment-chunk.entity.ts
// Change Log:
// - 2026-09-09: เพิ่ม entity สำหรับ ordered RAG Attachment chunks (Feature 254)

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Entity สำหรับ retrieval span ที่สร้างจาก RAG Attachment generation */
@Entity('rag_attachment_chunks')
@Index('idx_rag_chunks_attachment', ['attachmentUuid'])
@Index('idx_rag_chunks_generation', ['generationUuid'])
@Index('idx_rag_chunks_project', ['projectPublicId'])
@Index('idx_rag_chunks_owner', ['ownerType', 'ownerPublicId'])
export class RagAttachmentChunk {
  @PrimaryColumn({ name: 'chunk_public_id', type: 'uuid' })
  chunkPublicId!: string;

  @Column({ name: 'generation_uuid', type: 'uuid' })
  generationUuid!: string;

  @Column({ name: 'attachment_uuid', type: 'uuid' })
  attachmentUuid!: string;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'source_page_uuid', type: 'uuid' })
  sourcePageUuid!: string;

  @Column({
    name: 'segment_type',
    type: 'enum',
    enum: ['PAGE', 'SECTION', 'SHEET', 'WHOLE_DOCUMENT'],
  })
  segmentType!: 'PAGE' | 'SECTION' | 'SHEET' | 'WHOLE_DOCUMENT';

  @Column({ name: 'segment_number', type: 'int', nullable: true })
  segmentNumber?: number;

  @Column({ name: 'segment_label', length: 255, nullable: true })
  segmentLabel?: string;

  @Column({ name: 'source_locator', length: 1000, nullable: true })
  sourceLocator?: string;

  @Column({ name: 'start_offset', type: 'bigint' })
  startOffset!: string;

  @Column({ name: 'end_offset', type: 'bigint' })
  endOffset!: string;

  @Column({ name: 'doc_type', length: 50, nullable: true })
  docType?: string;

  @Column({ name: 'doc_number', length: 100, nullable: true })
  docNumber?: string;

  @Column({ name: 'revision', length: 50, nullable: true })
  revision?: string;

  @Column({ name: 'owner_type', length: 50 })
  ownerType!: string;

  @Column({ name: 'owner_public_id', type: 'uuid' })
  ownerPublicId!: string;

  @Column({ name: 'project_public_id', type: 'uuid' })
  projectPublicId!: string;

  @Column({
    type: 'enum',
    enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
    default: 'INTERNAL',
  })
  classification!: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

  @CreateDateColumn({ name: 'created_at', precision: 3 })
  createdAt!: Date;
}
