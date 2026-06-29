// File: src/modules/delegation/entities/delegation.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { User } from '../../user/entities/user.entity';
import { DelegationScope } from '../../common/enums/review.enums';

@Entity('delegations')
export class Delegation extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'delegator_user_id' })
  @Exclude()
  delegatorUserId!: number; // ผู้มอบหมาย (A)

  @Column({ name: 'delegate_user_id' })
  @Exclude()
  delegateUserId!: number; // ผู้รับมอบหมาย (B)

  @Column({
    type: 'enum',
    enum: DelegationScope,
    default: DelegationScope.ALL,
  })
  scope!: DelegationScope;

  @Column({ name: 'project_id', nullable: true })
  @Exclude()
  projectId?: number; // NULL = all projects (ถ้า scope = PROJECT)

  @Column({ name: 'start_date', type: 'date' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: Date;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'delegator_user_id' })
  delegator?: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'delegate_user_id' })
  delegate?: User;
}
