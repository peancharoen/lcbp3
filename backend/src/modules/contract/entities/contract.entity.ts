import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { Project } from '../../project/entities/project.entity';

@Entity('contracts')
export class Contract extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  // publicId inherited from UuidBaseEntity (DB column: uuid)

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
