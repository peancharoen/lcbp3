// File: src/modules/distribution/entities/distribution-matrix.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { DistributionRecipient } from './distribution-recipient.entity';
import { Project } from '../../project/entities/project.entity';

@Entity('distribution_matrices')
export class DistributionMatrix extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'project_id' })
  @Exclude()
  projectId!: number;

  @Column({ name: 'document_type_code', length: 20 })
  documentTypeCode!: string; // 'SDW', 'DDW', 'ADW', 'MS'...

  @Column({ name: 'response_code_filter', type: 'simple-array', nullable: true })
  responseCodeFilter?: string[]; // ['1A','1B'] — NULL = ทุก code

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @OneToMany(() => DistributionRecipient, (r: DistributionRecipient) => r.matrix, { cascade: true })
  recipients?: DistributionRecipient[];
}
