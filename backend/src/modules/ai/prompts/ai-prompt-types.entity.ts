// File: backend/src/modules/ai/prompts/ai-prompt-types.entity.ts
// Change Log:
// - 2026-09-01: Created AiPromptType entity for master prompt types table (Feature 251)

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

/**
 * Entity สำหรับเก็บประเภท AI prompt แบบ master table
 * ใช้ dynamic dropdown แทน hardcoded prompt type list (Feature 251, ADR-029)
 */
@Entity('ai_prompt_types')
export class AiPromptType {
  @PrimaryGeneratedColumn()
  @Exclude() // ADR-019: INT PK ไม่ expose ใน API
  id!: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true })
  publicId!: string;

  @Column({ name: 'prompt_type', length: 50, unique: true })
  promptType!: string;

  @Column({ name: 'display_name', length: 255 })
  displayName!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'expected_placeholders', type: 'json', nullable: true })
  expectedPlaceholders!: string[] | null;

  @Column({ name: 'is_system_managed', type: 'tinyint', width: 1, default: 1 })
  isSystemManaged!: boolean;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
