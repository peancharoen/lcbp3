// File: backend/src/modules/ai/entities/rag-attachment-page.entity.ts
// Change Log:
// - 2026-09-09: เพิ่ม entity สำหรับ normalized TextSegment ของ RAG Attachment (Feature 254)

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Entity สำหรับ source segment ที่ใช้เป็น canonical citation/rechunk source */
@Entity('rag_attachment_pages')
@Index('idx_rag_pages_generation', ['generationUuid'])
@Index('idx_rag_pages_attachment', ['attachmentUuid'])
export class RagAttachmentPage {
  @PrimaryColumn({ name: 'page_uuid', type: 'uuid' })
  pageUuid!: string;

  @Column({ name: 'generation_uuid', type: 'uuid' })
  generationUuid!: string;

  @Column({ name: 'attachment_uuid', type: 'uuid' })
  attachmentUuid!: string;

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

  @Column({ name: 'normalized_text', type: 'longtext' })
  normalizedText!: string;

  @Column({ name: 'normalized_start_offset', type: 'bigint', default: 0 })
  normalizedStartOffset!: string;

  @Column({ name: 'normalized_end_offset', type: 'bigint' })
  normalizedEndOffset!: string;

  @CreateDateColumn({ name: 'created_at', precision: 3 })
  createdAt!: Date;
}
