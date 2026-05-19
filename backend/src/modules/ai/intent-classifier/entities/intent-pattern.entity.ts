// File: src/modules/ai/intent-classifier/entities/intent-pattern.entity.ts
// Change Log
// - 2026-05-19: สร้าง Entity สำหรับตาราง ai_intent_patterns (ADR-024).

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { v7 as uuidv7 } from 'uuid';
import {
  PatternType,
  PatternLanguage,
} from '../interfaces/intent-category.enum';
import { IntentDefinition } from './intent-definition.entity';

/**
 * Entity สำหรับ Intent Patterns (keyword/regex)
 * ตาราง: ai_intent_patterns
 * ADR-019: publicId (UUIDv7) expose ผ่าน API, id (INT) ไม่ expose
 */
@Entity('ai_intent_patterns')
export class IntentPattern {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  /** UUID สาธารณะ (ADR-019) */
  @Column({ name: 'public_id', type: 'uuid', unique: true, nullable: false })
  publicId!: string;

  /** intentCode FK อ้างอิง ai_intent_definitions */
  @Index('idx_pattern_intent_code')
  @Column({ name: 'intent_code', type: 'varchar', length: 50 })
  intentCode!: string;

  /** ภาษาที่ Pattern รองรับ */
  @Column({
    name: 'language',
    type: 'enum',
    enum: PatternLanguage,
    default: PatternLanguage.ANY,
  })
  language!: PatternLanguage;

  /** ชนิดของ Pattern */
  @Column({
    name: 'pattern_type',
    type: 'enum',
    enum: PatternType,
    default: PatternType.KEYWORD,
  })
  patternType!: PatternType;

  /** ค่า Pattern (keyword string หรือ regex string) */
  @Column({ name: 'pattern_value', type: 'varchar', length: 255 })
  patternValue!: string;

  /** ลำดับการตรวจสอบ (ต่ำ = ตรวจก่อน) */
  @Index('idx_pattern_active_priority')
  @Column({ name: 'priority', type: 'int', default: 100 })
  priority!: number;

  /** สถานะการใช้งาน */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Relation กลับไป IntentDefinition */
  @ManyToOne(() => IntentDefinition, (def: IntentDefinition) => def.patterns, {
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'intent_code', referencedColumnName: 'intentCode' })
  intentDefinition!: IntentDefinition;

  /** สร้าง UUIDv7 ก่อน insert (ADR-019) */
  @BeforeInsert()
  generatePublicId(): void {
    if (!this.publicId) {
      this.publicId = uuidv7();
    }
  }
}
