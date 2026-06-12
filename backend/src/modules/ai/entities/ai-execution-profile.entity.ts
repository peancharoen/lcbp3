// File: backend/src/modules/ai/entities/ai-execution-profile.entity.ts
// Change Log:
// - 2026-06-11: Initial creation of AiExecutionProfile entity for AI execution profiles

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Entity สำหรับเก็บข้อมูลโปรไฟล์การทำงานของโมเดล AI (Execution Profile) */
@Entity('ai_execution_profiles')
export class AiExecutionProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'profile_name', unique: true, length: 50 })
  profileName!: string;

  @Column({ type: 'decimal', precision: 4, scale: 3 })
  temperature!: number;

  @Column({ name: 'top_p', type: 'decimal', precision: 4, scale: 3 })
  topP!: number;

  @Column({ name: 'max_tokens', type: 'int' })
  maxTokens!: number;

  @Column({ name: 'num_ctx', type: 'int' })
  numCtx!: number;

  @Column({ name: 'repeat_penalty', type: 'decimal', precision: 5, scale: 3 })
  repeatPenalty!: number;

  @Column({ name: 'keep_alive_seconds', type: 'int' })
  keepAliveSeconds!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
