// File: src/modules/tags/entities/correspondence-tag.entity.ts
// Change Log:
// - 2026-05-22: สร้างเอนทิตี CorrespondenceTag สำหรับจัดการความสัมพันธ์ M:N ระหว่าง Correspondence และ Tag (ADR-028)

import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tag } from './tag.entity';

/**
 * เอนทิตี CorrespondenceTag สำหรับเก็บความสัมพันธ์แบบ M:N ระหว่างเอกสารโต้ตอบและแท็ก
 */
@Entity('correspondence_tags')
export class CorrespondenceTag {
  @PrimaryColumn({ name: 'correspondence_id', type: 'int' })
  correspondenceId!: number;

  @PrimaryColumn({ name: 'tag_id', type: 'int' })
  tagId!: number;

  @Column({ name: 'is_ai_suggested', type: 'boolean', default: false })
  isAiSuggested!: boolean;

  @Column({
    name: 'confidence',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  confidence!: number | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag?: Tag;
}
