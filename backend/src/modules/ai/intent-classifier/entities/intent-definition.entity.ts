// File: src/modules/ai/intent-classifier/entities/intent-definition.entity.ts
// Change Log
// - 2026-05-19: สร้าง Entity สำหรับตาราง ai_intent_definitions (ADR-024).

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { v7 as uuidv7 } from 'uuid';
import { IntentCategory } from '../interfaces/intent-category.enum';
import { IntentPattern } from './intent-pattern.entity';

/**
 * Entity สำหรับ Intent Definitions
 * ตาราง: ai_intent_definitions
 * ADR-019: publicId (UUIDv7) expose ผ่าน API, id (INT) ไม่ expose
 */
@Entity('ai_intent_definitions')
export class IntentDefinition {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  /** UUID สาธารณะ (ADR-019) — ใช้ public_id เป็น column ไม่ใช่ uuid */
  @Column({ name: 'public_id', type: 'uuid', unique: true, nullable: false })
  publicId!: string;

  /** รหัส Intent เช่น 'RAG_QUERY', 'GET_RFA' — Unique */
  @Index('idx_intent_definition_code')
  @Column({ name: 'intent_code', type: 'varchar', length: 50, unique: true })
  intentCode!: string;

  /** คำอธิบายภาษาไทย */
  @Column({ name: 'description_th', type: 'varchar', length: 255 })
  descriptionTh!: string;

  /** คำอธิบายภาษาอังกฤษ */
  @Column({ name: 'description_en', type: 'varchar', length: 255 })
  descriptionEn!: string;

  /** หมวดหมู่: read, suggest, utility */
  @Column({
    name: 'category',
    type: 'enum',
    enum: IntentCategory,
  })
  category!: IntentCategory;

  /** สถานะการใช้งาน */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Patterns ที่เป็นของ Intent นี้ */
  @OneToMany(() => IntentPattern, (pattern) => pattern.intentDefinition)
  patterns!: IntentPattern[];

  /** สร้าง UUIDv7 ก่อน insert (ADR-019) */
  @BeforeInsert()
  generatePublicId(): void {
    if (!this.publicId) {
      this.publicId = uuidv7();
    }
  }
}
