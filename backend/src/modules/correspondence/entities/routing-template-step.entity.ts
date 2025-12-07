// File: src/modules/correspondence/entities/routing-template-step.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RoutingTemplate } from './routing-template.entity';
import { Organization } from '../../project/entities/organization.entity';
import { Role } from '../../user/entities/role.entity';

@Entity('correspondence_routing_template_steps')
export class RoutingTemplateStep {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'template_id' })
  templateId!: number;

  @Column()
  sequence!: number;

  @Column({ name: 'to_organization_id' })
  toOrganizationId!: number;

  @Column({ name: 'role_id', nullable: true })
  roleId?: number;

  @Column({ name: 'step_purpose', default: 'FOR_REVIEW' })
  stepPurpose!: string;

  @Column({ name: 'expected_days', nullable: true })
  expectedDays?: number;

  // Relations
  @ManyToOne(() => RoutingTemplate, (template) => template.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template?: RoutingTemplate;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'to_organization_id' })
  toOrganization?: Organization;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role?: Role;
}
