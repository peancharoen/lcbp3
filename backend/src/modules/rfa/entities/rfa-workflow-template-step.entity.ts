import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RfaWorkflowTemplate } from './rfa-workflow-template.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Role } from '../../user/entities/role.entity';

// ✅ 1. สร้าง Enum เพื่อให้ Type Safe
export enum RfaActionType {
  REVIEW = 'REVIEW',
  APPROVE = 'APPROVE',
  ACKNOWLEDGE = 'ACKNOWLEDGE',
}

@Entity('rfa_workflow_template_steps')
export class RfaWorkflowTemplateStep {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'template_id' })
  templateId!: number;

  @Column({ name: 'step_number' })
  stepNumber!: number;

  @Column({ name: 'organization_id' })
  organizationId!: number;

  @Column({ name: 'role_id', nullable: true })
  roleId?: number;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: RfaActionType, // ✅ 2. ใช้ Enum ตรงนี้
    nullable: true,
  })
  actionType?: RfaActionType; // ✅ 3. เปลี่ยน type จาก string เป็น Enum

  @Column({ name: 'duration_days', nullable: true })
  durationDays?: number;

  @Column({ name: 'is_optional', default: false })
  isOptional!: boolean;

  // Relations
  @ManyToOne(() => RfaWorkflowTemplate, (template) => template.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template!: RfaWorkflowTemplate;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role?: Role;
}
