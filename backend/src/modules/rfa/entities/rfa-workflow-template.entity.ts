import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RfaWorkflowTemplateStep } from './rfa-workflow-template-step.entity';

@Entity('rfa_workflow_templates')
export class RfaWorkflowTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'template_name', length: 100 })
  templateName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'json', nullable: true })
  workflowConfig?: Record<string, any>; // Configuration เพิ่มเติม

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => RfaWorkflowTemplateStep, (step) => step.template, {
    cascade: true,
  })
  steps!: RfaWorkflowTemplateStep[];
}
