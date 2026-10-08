// File: backend/src/modules/reminder/entities/reminder-rule-recipient.entity.ts
// Change Log:
// - 2026-10-06: Initial creation — structured recipients แทน notify_roles simple-array (User Grouping Model)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { ReminderRule } from './reminder-rule.entity';

/**
 * Recipient type ของ reminder rule
 * - symbolic (recipientRef=NULL): TASK_ASSIGNEE / TEAM_LEAD / PROJECT_MANAGER — resolve จาก task context
 * - concrete (recipientRef=publicId): USER/ROLE/TEAM/GROUP/DEPARTMENT — resolve จาก entity นั้น
 */
export enum ReminderRecipientType {
  TASK_ASSIGNEE = 'TASK_ASSIGNEE',
  TEAM_LEAD = 'TEAM_LEAD',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  USER = 'USER',
  ROLE = 'ROLE',
  TEAM = 'TEAM',
  GROUP = 'GROUP',
  DEPARTMENT = 'DEPARTMENT',
}

/**
 * Structured recipient ของ reminder rule — polymorphic ref (no FK on recipientRef, same pattern as distribution_recipients)
 * ขยาย type ในอนาคต = เพิ่ม enum value ไม่ต้องแก้ resolver logic หลัก
 */
@Entity('reminder_rule_recipients')
export class ReminderRuleRecipient extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'rule_id' })
  @Exclude()
  ruleId!: number;

  @Column({
    name: 'recipient_type',
    type: 'enum',
    enum: ReminderRecipientType,
  })
  recipientType!: ReminderRecipientType;

  @Column({ name: 'recipient_ref', type: 'uuid', nullable: true })
  recipientRef?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => ReminderRule, (rule) => rule.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rule_id' })
  rule?: ReminderRule;
}
