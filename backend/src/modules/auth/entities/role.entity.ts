import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('permissions')
export class Permission extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'permission_id' })
  id!: number;

  @Column({ name: 'permission_name', length: 100, unique: true })
  permissionName!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string;

  @Column({ name: 'module', length: 50, nullable: true })
  module?: string;

  @Column({
    name: 'scope_level',
    type: 'enum',
    enum: ['GLOBAL', 'ORG', 'PROJECT'],
    nullable: true,
  })
  scopeLevel?: 'GLOBAL' | 'ORG' | 'PROJECT';

  @Column({ name: 'is_active', default: true, type: 'tinyint' })
  isActive!: boolean;
}

@Entity('roles')
export class Role extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'role_id' })
  id!: number;

  @Column({ name: 'role_name', length: 50, unique: true })
  roleName!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string;

  @Column({
    type: 'enum',
    enum: ['Global', 'Organization', 'Project', 'Contract'],
    default: 'Global',
  })
  scope!: 'Global' | 'Organization' | 'Project' | 'Contract';

  @Column({ name: 'is_system', default: false })
  isSystem!: boolean;

  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions!: Permission[];
}
