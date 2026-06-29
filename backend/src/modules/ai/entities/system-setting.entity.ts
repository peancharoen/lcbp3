// File: src/modules/ai/entities/system-setting.entity.ts
// Change Log
// - 2026-05-21: สร้าง Entity SystemSetting สำหรับ AI Admin Console settings.

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SystemSettingDataType = 'string' | 'number' | 'boolean' | 'json';

/** Entity สำหรับเก็บค่าตั้งค่าระบบแบบไดนามิก */
@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'setting_key', unique: true, length: 100 })
  settingKey!: string;

  @Column({ name: 'setting_value', type: 'text' })
  settingValue!: string;

  @Column({
    name: 'data_type',
    type: 'enum',
    enum: ['string', 'number', 'boolean', 'json'],
    default: 'string',
  })
  dataType!: SystemSettingDataType;

  @Column({ length: 50, nullable: true })
  category?: string;

  @Column({ name: 'is_encrypted', type: 'boolean', default: false })
  isEncrypted!: boolean;

  @Column({ name: 'validation_rules', type: 'json', nullable: true })
  validationRules?: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
