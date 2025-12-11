// File: src/modules/user/entities/user.entity.ts
// บันทึกการแก้ไข: เพิ่ม Relations กับ UserAssignment และ UserPreference (T1.3)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity'; // Adjust path as needed
import { UserAssignment } from './user-assignment.entity';
import { UserPreference } from './user-preference.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  user_id!: number;

  @Column({ unique: true, length: 50 })
  username!: string;

  @Column({ name: 'password_hash', select: false }) // ไม่ Select Password โดย Default
  password!: string;

  @Column({ unique: true, length: 100 })
  email!: string;

  @Column({ name: 'first_name', nullable: true, length: 50 })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true, length: 50 })
  lastName?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'failed_attempts', default: 0 })
  failedAttempts!: number;

  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
  lockedUntil?: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'line_id', nullable: true, length: 100 })
  lineId?: string;

  // Relation กับ Organization (สังกัดหลัก)
  @Column({ name: 'primary_organization_id', nullable: true })
  primaryOrganizationId?: number;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_organization_id' })
  organization?: Organization;

  // Relation กับ Assignments (RBAC)
  @OneToMany(() => UserAssignment, (assignment) => assignment.user)
  assignments?: UserAssignment[];

  // Relation กับ Preferences (1:1)
  @OneToOne(() => UserPreference, (pref) => pref.user, { cascade: true })
  preference?: UserPreference;

  // Base Entity Fields
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', select: false })
  deletedAt?: Date;
}
