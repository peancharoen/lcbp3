// File: src/modules/review-team/entities/review-task.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { ReviewTeam } from './review-team.entity';
import { ResponseCode } from '../../response-code/entities/response-code.entity';
import { User } from '../../user/entities/user.entity';
import { Discipline } from '../../master/entities/discipline.entity';
import { ReviewTaskStatus } from '../../common/enums/review.enums';

@Entity('review_tasks')
export class ReviewTask extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'rfa_revision_id' })
  @Exclude()
  rfaRevisionId!: number;

  @Column({ name: 'team_id' })
  @Exclude()
  teamId!: number;

  @Column({ name: 'discipline_id' })
  @Exclude()
  disciplineId!: number;

  @Column({ name: 'assigned_to_user_id', nullable: true })
  @Exclude()
  assignedToUserId?: number; // NULL = auto-assign ตาม discipline

  @Column({
    type: 'enum',
    enum: ReviewTaskStatus,
    default: ReviewTaskStatus.PENDING,
  })
  status!: ReviewTaskStatus;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: Date;

  @Column({ name: 'response_code_id', nullable: true })
  @Exclude()
  responseCodeId?: number;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ type: 'json', nullable: true })
  attachments?: string[]; // Array ของ attachment publicIds

  @Column({ name: 'delegated_from_user_id', nullable: true })
  @Exclude()
  delegatedFromUserId?: number; // ติดตาม delegation chain

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @VersionColumn()
  version!: number; // Optimistic locking (ADR-002)

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => ReviewTeam)
  @JoinColumn({ name: 'team_id' })
  team?: ReviewTeam;

  @ManyToOne(() => Discipline)
  @JoinColumn({ name: 'discipline_id' })
  discipline?: Discipline;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_to_user_id' })
  assignedToUser?: User;

  @ManyToOne(() => ResponseCode)
  @JoinColumn({ name: 'response_code_id' })
  responseCode?: ResponseCode;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'delegated_from_user_id' })
  delegatedFromUser?: User;

  @ManyToOne('RfaRevision')
  @JoinColumn({ name: 'rfa_revision_id' })
  rfaRevision?: unknown; // Use unknown to avoid circular dependency and satisfy linter
}
