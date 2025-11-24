import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RfaRevision } from './rfa-revision.entity';
import { Organization } from '../../project/entities/organization.entity';
import { User } from '../../user/entities/user.entity';

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
    enum: ['REVIEW', 'APPROVE', 'ACKNOWLEDGE'],
    nullable: true,
  })
  actionType?: string;

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
  stateContext?: Record<string, any>; // เก็บ Snapshot ข้อมูล ณ ขณะนั้น

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => RfaRevision, (rev) => rev.workflows, { onDelete: 'CASCADE' }) // ต้องไปเพิ่ม Property workflows ใน RfaRevision ด้วย
  @JoinColumn({ name: 'rfa_revision_id' })
  rfaRevision!: RfaRevision;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_to' })
  assignee?: User;
}
