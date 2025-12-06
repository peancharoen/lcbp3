import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Permission } from './permission.entity';

export enum RoleScope {
  GLOBAL = 'Global',
  ORGANIZATION = 'Organization',
  PROJECT = 'Project',
  CONTRACT = 'Contract',
}

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn({ name: 'role_id' })
  roleId!: number;

  @Column({ name: 'role_name', length: 100 })
  roleName!: string;

  @Column({
    type: 'enum',
    enum: RoleScope,
  })
  scope!: RoleScope;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_system', default: false })
  isSystem!: boolean;

  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'roleId' },
    inverseJoinColumn: {
      name: 'permission_id',
      referencedColumnName: 'permissionId',
    },
  })
  permissions?: Permission[];
}
