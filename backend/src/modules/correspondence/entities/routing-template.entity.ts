import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity.js'; // ถ้าไม่ได้ใช้ BaseEntity ก็ลบออกแล้วใส่ createdAt เอง
import { RoutingTemplateStep } from './routing-template-step.entity.js'; // เดี๋ยวสร้าง

@Entity('correspondence_routing_templates')
export class RoutingTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'template_name', length: 255 })
  templateName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'project_id', nullable: true })
  projectId?: number; // NULL = แม่แบบทั่วไป

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'json', nullable: true, name: 'workflow_config' })
  workflowConfig?: any;

  @OneToMany(() => RoutingTemplateStep, (step) => step.template)
  steps?: RoutingTemplateStep[];
}
