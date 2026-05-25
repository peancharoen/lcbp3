// File: src/modules/ai/entities/ai-available-model.entity.ts
// Change Log:
// - 2026-05-25: สร้าง Entity AiAvailableModel สำหรับจัดการรายการโมเดล AI แบบไดนามิก (ADR-027)

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Entity สำหรับเก็บรายการโมเดล AI ที่ให้เลือกใช้งานในระบบ */
@Entity('ai_available_models')
@Index(['isActive'])
@Index(['isDefault'])
export class AiAvailableModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'model_name', unique: true, length: 100 })
  modelName!: string;

  @Column({ name: 'model_version', length: 50 })
  modelVersion!: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({
    name: 'vram_gb',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  vramGb?: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
