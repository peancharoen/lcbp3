import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'organization_code', unique: true, length: 20 })
  organizationCode!: string;

  @Column({ name: 'organization_name', length: 255 })
  organizationName!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
