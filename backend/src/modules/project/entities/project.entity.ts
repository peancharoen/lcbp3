import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity.js';

@Entity('projects')
export class Project extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_code', unique: true, length: 50 })
  projectCode!: string;

  @Column({ name: 'project_name', length: 255 })
  projectName!: string;

  @Column({ name: 'is_active', default: 1, type: 'tinyint' })
  isActive!: boolean;
}
