import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RoutingTemplate } from './routing-template.entity.js';
import { Organization } from '../../project/entities/organization.entity.js';

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

  @Column({ name: 'step_purpose', default: 'FOR_REVIEW' })
  stepPurpose!: string; // FOR_APPROVAL, FOR_REVIEW

  @Column({ name: 'expected_days', nullable: true })
  expectedDays?: number;

  @ManyToOne(() => RoutingTemplate, (t) => t.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template?: RoutingTemplate;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'to_organization_id' })
  toOrganization?: Organization;
}
