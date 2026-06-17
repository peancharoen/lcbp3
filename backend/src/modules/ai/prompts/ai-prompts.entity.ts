// File: backend/src/modules/ai/prompts/ai-prompts.entity.ts
// Change Log
// - 2026-05-25: Created TypeORM entity for dynamic prompt management (ADR-029)
// - 2026-05-25: Added definite assignment assertion operator (!) to satisfy strictPropertyInitialization
// - 2026-05-27: Added publicId column for ADR-019 compliance
// - 2026-06-15: Added @VersionColumn for optimistic locking (T066)
// - 2026-06-15: Fixed publicId column name mapping to public_id (snake_case); removed @VersionColumn until schema delta adds version column

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

/**
 * Entity สำหรับเก็บข้อมูลประวัติและการตั้งค่า Prompt version ต่างๆ
 * สำหรับการสกัดข้อมูลเอกสารผ่าน OCR และ LLM
 */
@Entity('ai_prompts')
export class AiPrompt {
  @PrimaryGeneratedColumn()
  @Exclude() // ADR-019: INT PK ไม่ expose ใน API
  id!: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true })
  publicId!: string;

  @Column({ name: 'prompt_type', length: 50 })
  promptType!: string;

  @Column({ name: 'version_number' })
  versionNumber!: number;

  @Column({ type: 'text' })
  template!: string;

  @Column({ name: 'field_schema', type: 'json', nullable: true })
  fieldSchema!: Record<string, unknown> | null;

  @Column({ name: 'context_config', type: 'json', nullable: true })
  contextConfig!: Record<string, unknown> | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 0 })
  isActive!: boolean;

  @Column({ name: 'test_result_json', type: 'json', nullable: true })
  testResultJson!: Record<string, unknown> | null;

  @Column({ name: 'manual_note', type: 'text', nullable: true })
  manualNote!: string | null;

  @Column({ name: 'last_tested_at', type: 'timestamp', nullable: true })
  lastTestedAt!: Date | null;

  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt!: Date | null;

  @Column({ name: 'created_by' })
  @Exclude() // FK ไม่ expose โดยตรง
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @VersionColumn({ name: 'version' })
  version!: number;
}
