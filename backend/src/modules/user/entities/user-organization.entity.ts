// File: backend/src/modules/user/entities/user-organization.entity.ts
// Change Log:
// - 2026-10-06: Initial creation — membership user ↔ org พร้อมแผนก+ตำแหน่ง (User Grouping Model)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { User } from './user.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Department } from '../../organization/entities/department.entity';

/**
 * Membership ของ user ในแต่ละ organization (multi-org)
 * - is_primary=1 = สังกัดหลัก (sync กับ users.primary_organization_id — denormalized pointer)
 * - position/department ผูกกับ org: คนเดียวกันอาจเป็นตำแหน่งต่างกันในแต่ละ org
 */
@Entity('user_organizations')
@Unique('uk_user_org', ['userId', 'organizationId'])
export class UserOrganization extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'user_id' })
  @Exclude()
  userId!: number;

  @Column({ name: 'organization_id' })
  @Exclude()
  organizationId!: number;

  @Column({ name: 'department_id', nullable: true })
  @Exclude()
  departmentId?: number;

  @Column({ length: 100, nullable: true })
  position?: string;

  @Column({ name: 'is_primary', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department?: Department;
}
