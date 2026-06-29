import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * @deprecated This entity is deprecated and will be removed in future versions.
 * Use WorkflowDefinition from the Unified Workflow Engine instead.
 *
 * This entity is kept for backward compatibility and historical data.
 * Relations have been removed to prevent TypeORM errors.
 */
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

  @Column({ name: 'step_purpose', length: 50, default: 'FOR_REVIEW' })
  stepPurpose!: string;

  @Column({ name: 'expected_days', default: 7 })
  expectedDays!: number;

  // @deprecated - Relation removed, use WorkflowDefinition instead
  // template?: RoutingTemplate;
}
