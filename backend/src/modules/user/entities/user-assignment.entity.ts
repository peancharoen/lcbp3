import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity.js';
// Import Role, Org, Project, Contract entities...

@Entity('user_assignments')
export class UserAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'role_id' })
  roleId!: number;

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

  // Relation กลับไปหา User (เจ้าของสิทธิ์)
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
