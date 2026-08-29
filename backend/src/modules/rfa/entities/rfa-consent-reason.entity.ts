import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * ADR-049: Master table for CONSULTANT consent reason metadata
 * เก็บเหตุผลของ CONSULTANT consent (NO_OBJECTION, COMMENTS_PROVIDED, etc.)
 * เป็น metadata ไม่มีผลต่อ workflow state — แยกจาก rfa_approve_codes ตาม ADR-049
 */
@Entity('rfa_consent_reasons')
export class RfaConsentReason {
  @PrimaryGeneratedColumn()
  id!: number;

  // ADR-019: UUID สำหรับ API response — expose แทน INT id
  @Column({
    name: 'public_id',
    type: 'char',
    length: 36,
    unique: true,
    comment: 'ADR-019: UUIDv7',
  })
  publicId!: string;

  @Column({
    length: 20,
    unique: true,
    comment: 'Consent reason code (NO_OBJECTION, COMMENTS_PROVIDED, etc.)',
  })
  code!: string;

  @Column({ length: 200, comment: 'Consent reason description' })
  description!: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
