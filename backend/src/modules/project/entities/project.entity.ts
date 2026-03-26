import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { Contract } from '../../contract/entities/contract.entity';

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

  @OneToMany(() => Contract, (contract) => contract.project)
  contracts!: Contract[];
}
