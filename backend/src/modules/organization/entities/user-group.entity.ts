// File: backend/src/modules/organization/entities/user-group.entity.ts
// Change Log:
// - 2026-10-06: Initial creation — functional group ของ user ภายใน org (User Grouping Model)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { Organization } from './organization.entity';
import { UserGroupMember } from './user-group-member.entity';

/**
 * Functional group ของ user ภายใน org (เช่น "ทีม QC", "ฝ่ายเอกสาร")
 * ใช้เป็น pool สำหรับ claim-based assignment (circulation), distribution และ reminder recipients
 * ห้ามใช้แทน review_teams (project-scoped ผูก RFA) หรือ departments (หน่วยงานของบริษัท)
 */
@Entity('user_groups')
@Unique('uk_user_group_name', ['organizationId', 'name'])
export class UserGroup extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'organization_id' })
  @Exclude()
  organizationId!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 255, nullable: true })
  description?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @OneToMany(() => UserGroupMember, (member) => member.group)
  members?: UserGroupMember[];
}
