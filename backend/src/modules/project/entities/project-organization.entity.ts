import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './project.entity.js';
import { Organization } from './organization.entity.js';

@Entity('project_organizations')
export class ProjectOrganization {
  // Composite Primary Key (ใช้ 2 คอลัมน์รวมกันเป็น PK)
  @PrimaryColumn({ name: 'project_id' })
  projectId!: number;

  @PrimaryColumn({ name: 'organization_id' })
  organizationId!: number;

  // Relation ไปยัง Project
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  // Relation ไปยัง Organization
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;
}
