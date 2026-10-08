// File: src/modules/reminder/entities/reminder-rule.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { ReminderType } from '../../common/enums/review.enums';
import { ReminderRuleRecipient } from './reminder-rule-recipient.entity';

@Entity('reminder_rules')
export class ReminderRule extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'project_id', nullable: true })
  @Exclude()
  projectId?: number; // NULL = global rule

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'document_type_code', length: 20, nullable: true })
  documentTypeCode?: string; // 'SDW', 'DDW' — NULL = all types

  @Column({
    type: 'enum',
    enum: ReminderType,
  })
  reminderType!: ReminderType;

  @Column({ name: 'days_before_due', type: 'int' })
  daysBeforeDue!: number; // บวก = ก่อน due, ลบ = หลัง due (overdue)

  @Column({ name: 'escalation_level', type: 'tinyint', default: 0 })
  escalationLevel!: number; // 0 = reminder, 1 = escalation L1, 2 = escalation L2

  /** Structured recipients (แทน notify_roles simple-array เดิม) — resolve โดย RecipientResolverService */
  @OneToMany(() => ReminderRuleRecipient, (recipient) => recipient.rule, {
    cascade: true,
  })
  recipients?: ReminderRuleRecipient[];

  @Column({ name: 'message_template', type: 'text', nullable: true })
  messageTemplate?: string;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
