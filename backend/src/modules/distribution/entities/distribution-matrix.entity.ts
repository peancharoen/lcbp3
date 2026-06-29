// File: src/modules/distribution/entities/distribution-matrix.entity.ts
// Change Log
// - 2026-05-14: Align columns with canonical v1.9.0 schema and ADR-019 publicId contract.
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { DistributionRecipient } from './distribution-recipient.entity';
import { Project } from '../../project/entities/project.entity';
import { ResponseCode } from '../../response-code/entities/response-code.entity';

export interface DistributionConditions {
  codes?: string[];
  excludeCodes?: string[];
}

@Entity('distribution_matrices')
export class DistributionMatrix extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'project_id', nullable: true })
  @Exclude()
  projectId?: number;

  @Column({ name: 'document_type_id' })
  @Exclude()
  documentTypeId!: number;

  @Column({ name: 'response_code_id', nullable: true })
  @Exclude()
  responseCodeId?: number;

  @Column({ type: 'json', nullable: true })
  conditions?: DistributionConditions;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @ManyToOne(() => ResponseCode)
  @JoinColumn({ name: 'response_code_id' })
  responseCode?: ResponseCode;

  @OneToMany(
    () => DistributionRecipient,
    (r: DistributionRecipient) => r.matrix,
    { cascade: true }
  )
  recipients?: DistributionRecipient[];
}
