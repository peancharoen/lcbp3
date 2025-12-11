// File: src/modules/correspondence/entities/correspondence-routing.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CorrespondenceRevision } from './correspondence-revision.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../user/entities/user.entity';
import { RoutingTemplate } from './routing-template.entity';

@Entity('correspondence_routings')
export class CorrespondenceRouting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'correspondence_id' })
  correspondenceId!: number;

  @Column({ name: 'template_id', nullable: true })
  templateId?: number;

  @Column()
  sequence!: number;

  @Column({ name: 'from_organization_id' })
  fromOrganizationId!: number;

  @Column({ name: 'to_organization_id' })
  toOrganizationId!: number;

  @Column({ name: 'step_purpose', default: 'FOR_REVIEW' })
  stepPurpose!: string;

  @Column({ default: 'SENT' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ name: 'due_date', type: 'datetime', nullable: true })
  dueDate?: Date;

  @Column({ name: 'processed_by_user_id', nullable: true })
  processedByUserId?: number;

  @Column({ name: 'processed_at', type: 'datetime', nullable: true })
  processedAt?: Date;

  // ✅ [New] เพิ่ม State Context เพื่อเก็บ Snapshot ข้อมูล Workflow ณ จุดนั้น
  @Column({ name: 'state_context', type: 'json', nullable: true })
  stateContext?: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => CorrespondenceRevision, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'correspondence_id' })
  correspondenceRevision?: CorrespondenceRevision;

  @ManyToOne(() => RoutingTemplate)
  @JoinColumn({ name: 'template_id' })
  template?: RoutingTemplate;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'from_organization_id' })
  fromOrganization?: Organization;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'to_organization_id' })
  toOrganization?: Organization;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'processed_by_user_id' })
  processedBy?: User;
}
