import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Circulation } from './circulation.entity';
import { Organization } from '../../project/entities/organization.entity';
import { User } from '../../user/entities/user.entity';

@Entity('circulation_routings')
export class CirculationRouting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'circulation_id' })
  circulationId!: number;

  @Column({ name: 'step_number' })
  stepNumber!: number;

  @Column({ name: 'organization_id' })
  organizationId!: number;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo?: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
    default: 'PENDING',
  })
  status!: string;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Circulation, (c) => c.routings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'circulation_id' })
  circulation!: Circulation;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_to' })
  assignee?: User;
}
