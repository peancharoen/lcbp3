// File: backend/src/modules/user/entities/role.entity.ts
// Change Log:
//   - v1.9.0 (2026-05-13): เพิ่ม publicId (uuid) column ตาม delta-11 + ADR-019
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Permission } from './permission.entity';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';

/** ขอบเขตของบทบาท */
export enum RoleScope {
  GLOBAL = 'Global',
  ORGANIZATION = 'Organization',
  PROJECT = 'Project',
  CONTRACT = 'Contract',
}

/**
 * Entity สำหรับตาราง roles
 *
 * @remarks
 * - Internal PK: roleId (INT) — ห้าม expose ใน API (ADR-019)
 * - Public ID: publicId (UUID) — ใช้ใน API Response และ distribution_recipients (delta-11)
 */
@Entity('roles')
export class Role extends UuidBaseEntity {
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
