// File: backend/src/modules/project/entities/project.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { Contract } from '../../contract/entities/contract.entity';

// Change Log:
// - 2026-03-27: เพิ่ม createdAt, updatedAt, deletedAt ที่ขาดหายไปตาม DB schema (แก้ Unknown column 'project.createdAt')

@Entity('projects')
export class Project extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  // publicId inherited from UuidBaseEntity (DB column: uuid)

  @Column({ name: 'project_code', unique: true, length: 50 })
  projectCode!: string;

  @Column({ name: 'project_name', length: 255 })
  projectName!: string;

  @Column({ name: 'is_active', default: 1, type: 'tinyint' })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', select: false })
  deletedAt?: Date;

  @OneToMany(() => Contract, (contract) => contract.project)
  contracts!: Contract[];
}
