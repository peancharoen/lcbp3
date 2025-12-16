// backend/src/modules/document-numbering/entities/document-number-format.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity';
import { CorrespondenceType } from '../../correspondence/entities/correspondence-type.entity';

@Entity('document_number_formats')
@Unique(['projectId', 'correspondenceTypeId'])
export class DocumentNumberFormat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'correspondence_type_id', nullable: true })
  correspondenceTypeId: number | null;

  @Column({ name: 'format_template', length: 100 })
  formatTemplate: string;

  @Column({ name: 'description', nullable: true })
  description: string;

  // [NEW] Control yearly reset behavior
  @Column({ name: 'reset_sequence_yearly', default: true })
  resetSequenceYearly: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => CorrespondenceType)
  @JoinColumn({ name: 'correspondence_type_id' })
  correspondenceType: CorrespondenceType | null;
}
