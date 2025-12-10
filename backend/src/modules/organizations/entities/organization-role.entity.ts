import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * OrganizationRole Entity
 * Represents the role/type of an organization in the system
 * (OWNER, DESIGNER, CONSULTANT, CONTRACTOR, THIRD_PARTY)
 *
 * Schema reference: organization_roles table (lines 205-211 in schema SQL)
 */
@Entity('organization_roles')
export class OrganizationRole extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'role_name',
    length: 20,
    unique: true,
    comment: 'Role name (OWNER, DESIGNER, CONSULTANT, CONTRACTOR, THIRD_PARTY)'
  })
  roleName!: string;
}
