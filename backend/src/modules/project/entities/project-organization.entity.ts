// File: backend/src/modules/project/entities/project-organization.entity.ts
// Change Log:
// - 2026-10-06: เพิ่ม role_id (FK → organization_roles) ตามการตัด organizations.role_id ออก
import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './project.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { OrganizationRole } from '../../organization/entities/organization-role.entity';

@Entity('project_organizations')
export class ProjectOrganization {
  // Composite Primary Key (ใช้ 2 คอลัมน์รวมกันเป็น PK)
  @PrimaryColumn({ name: 'project_id' })
  projectId!: number;

  @PrimaryColumn({ name: 'organization_id' })
  organizationId!: number;

  @Column({ name: 'role_id', nullable: true })
  roleId?: number;

  // Relation ไปยัง Project
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  // Relation ไปยัง Organization
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  // Relation ไปยัง OrganizationRole
  @ManyToOne(() => OrganizationRole, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role_id' })
  organizationRole?: OrganizationRole;
}
