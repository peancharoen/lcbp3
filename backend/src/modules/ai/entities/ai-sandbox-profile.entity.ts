// File: backend/src/modules/ai/entities/ai-sandbox-profile.entity.ts
// Change Log:
// - 2026-06-13: ADR-036 — เพิ่ม sandbox draft profile entity สำหรับ AI parameter tuning

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Entity สำหรับเก็บ draft parameters ที่ admin ทดลองก่อน Apply to Production */
@Entity('ai_sandbox_profiles')
export class AiSandboxProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'profile_name', unique: true, length: 50 })
  profileName!: string;

  @Column({ name: 'canonical_model', length: 20, default: 'np-dms-ai' })
  canonicalModel!: 'np-dms-ai' | 'np-dms-ocr';

  @Column({ type: 'decimal', precision: 4, scale: 3 })
  temperature!: number;

  @Column({ name: 'top_p', type: 'decimal', precision: 4, scale: 3 })
  topP!: number;

  @Column({ name: 'max_tokens', type: 'int', nullable: true })
  maxTokens!: number | null;

  @Column({ name: 'num_ctx', type: 'int', nullable: true })
  numCtx!: number | null;

  @Column({ name: 'repeat_penalty', type: 'decimal', precision: 5, scale: 3 })
  repeatPenalty!: number;

  @Column({ name: 'keep_alive_seconds', type: 'int' })
  keepAliveSeconds!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy?: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
