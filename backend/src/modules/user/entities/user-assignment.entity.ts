// File: src/modules/user/entities/user-assignment.entity.ts
// บันทึกการแก้ไข: Entity สำหรับการมอบหมาย Role ให้กับ User ตาม Scope (T1.3, RBAC 4-Level)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Organization } from '../../organization/entities/organization.entity'; // ปรับ Path ให้ตรงกับ ProjectModule
import { Project } from '../../project/entities/project.entity'; // ปรับ Path ให้ตรงกับ ProjectModule
import { Contract } from '../../contract/entities/contract.entity'; // ปรับ Path ให้ตรงกับ ProjectModule

@Entity('user_assignments')
export class UserAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'role_id' })
  roleId!: number;

  // --- Scopes (เลือกได้เพียง 1 หรือเป็น NULL ทั้งหมดสำหรับ Global) ---
  @Column({ name: 'organization_id', nullable: true })
  organizationId?: number;

  @Column({ name: 'project_id', nullable: true })
  projectId?: number;

  @Column({ name: 'contract_id', nullable: true })
  contractId?: number;

  @Column({ name: 'assigned_by_user_id', nullable: true })
  assignedByUserId?: number;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt!: Date;

  // --- Relations ---

  @ManyToOne(() => User, (user) => user.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_by_user_id' })
  assignedBy?: User;
}
