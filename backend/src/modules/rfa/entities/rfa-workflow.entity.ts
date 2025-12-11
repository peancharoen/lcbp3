// File: src/modules/rfa/entities/rfa-workflow.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../user/entities/user.entity';
import { RfaRevision } from './rfa-revision.entity';
import { RfaActionType } from './rfa-workflow-template-step.entity'; // ✅ Import Enum

@Entity('rfa_workflows')
export class RfaWorkflow {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rfa_revision_id' })
  rfaRevisionId!: number;

  @Column({ name: 'step_number' })
  stepNumber!: number;

  @Column({ name: 'organization_id' })
  organizationId!: number;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo?: number;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: RfaActionType, // ✅ Use Shared Enum
    nullable: true,
  })
  actionType?: RfaActionType;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
    nullable: true,
  })
  status?: string;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'json', nullable: true })
  stateContext?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => RfaRevision, (rev) => rev.workflows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rfa_revision_id' })
  rfaRevision!: RfaRevision;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_to' })
  assignee?: User;
}
