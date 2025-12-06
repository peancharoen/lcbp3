import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Project } from './project.entity';

@Entity('contracts')
export class Contract extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id' })
  projectId!: number;

  @Column({ name: 'contract_code', unique: true, length: 50 })
  contractCode!: string;

  @Column({ name: 'contract_name', length: 255 })
  contractName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate?: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: Date;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  // Relation
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;
}
