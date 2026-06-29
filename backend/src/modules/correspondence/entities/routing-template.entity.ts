import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * @deprecated This entity is deprecated and will be removed in future versions.
 * Use WorkflowDefinition from the Unified Workflow Engine instead.
 *
 * This entity is kept for backward compatibility and historical data.
 * The relation to RoutingTemplateStep has been removed to prevent TypeORM errors.
 */
@Entity('correspondence_routing_templates')
export class RoutingTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'template_name', length: 255 })
  templateName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'project_id', nullable: true })
  projectId?: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'json', nullable: true, name: 'workflow_config' })
  workflowConfig?: Record<string, unknown>;

  // @deprecated - Relation removed, use WorkflowDefinition instead
  // steps?: RoutingTemplateStep[];
}
