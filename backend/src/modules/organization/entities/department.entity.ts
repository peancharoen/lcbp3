// File: backend/src/modules/organization/entities/department.entity.ts
// Change Log:
// - 2026-10-06: Initial creation — แผนกภายในองค์กร (User Grouping Model)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { Organization } from './organization.entity';

/**
 * แผนก/ฝ่ายภายในองค์กร (flat — ไม่มี hierarchy)
 * ตำแหน่ง/แผนกผูกกับ org context: คนเดียวกันอาจเป็นแผนกต่างกันในแต่ละ org
 */
@Entity('departments')
@Unique('uk_department_code', ['organizationId', 'departmentCode'])
export class Department extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'organization_id' })
  @Exclude()
  organizationId!: number;

  @Column({ name: 'department_code', length: 20 })
  departmentCode!: string;

  @Column({ name: 'department_name', length: 255 })
  departmentName!: string;

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
}
