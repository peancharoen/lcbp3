import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Project } from '../../project/entities/project.entity';

@Entity('contracts')
export class Contract extends BaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({
    type: 'uuid',
    unique: true,
    nullable: false,
    comment: 'UUID Public Identifier (ADR-019)',
  })
  uuid!: string;

  @BeforeInsert()
  generateUuid(): void {
    if (!this.uuid) {
      this.uuid = uuidv7();
    }
  }

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
