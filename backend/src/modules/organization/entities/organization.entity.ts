import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrganizationRole } from './organization-role.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'organization_code', length: 20, unique: true })
  @Index('idx_org_code')
  organizationCode!: string;

  @Column({ name: 'organization_name', length: 255 })
  organizationName!: string;

  @Column({ name: 'role_id', nullable: true })
  roleId?: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date;

  // Relations
  @ManyToOne(() => OrganizationRole, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  organizationRole?: OrganizationRole;
}
