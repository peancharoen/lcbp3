// File: src/modules/reminder/entities/reminder-history.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { ReviewTask } from '../../review-team/entities/review-task.entity';
import { User } from '../../user/entities/user.entity';
import { ReminderType } from '../../common/enums/review.enums';

@Entity('reminder_histories')
export class ReminderHistory extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'task_id' })
  @Exclude()
  taskId!: number;

  @Column({ name: 'user_id' })
  @Exclude()
  userId!: number;

  @Column({
    type: 'enum',
    enum: ReminderType,
  })
  reminderType!: ReminderType;

  @Column({ name: 'escalation_level', type: 'tinyint', default: 0 })
  escalationLevel!: number;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt!: Date;

  // Relations
  @ManyToOne(() => ReviewTask)
  @JoinColumn({ name: 'task_id' })
  task?: ReviewTask;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
