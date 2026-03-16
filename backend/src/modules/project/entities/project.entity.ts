import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  BeforeInsert,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Exclude, Expose } from 'class-transformer';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Contract } from '../../contract/entities/contract.entity';

@Entity('projects')
export class Project extends BaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Expose({ name: 'id' })
  @Column({
    type: 'uuid',
    unique: true,
    nullable: false,
    comment: 'UUID Public Identifier (ADR-019)',
  })
  uuid!: string;

  @BeforeInsert()
  generateUuid(): void {
    if (!this.uuid) {
      this.uuid = uuidv7();
    }
  }

  @Column({ name: 'project_code', unique: true, length: 50 })
  projectCode!: string;

  @Column({ name: 'project_name', length: 255 })
  projectName!: string;

  @Column({ name: 'is_active', default: 1, type: 'tinyint' })
  isActive!: boolean;

  @OneToMany(() => Contract, (contract) => contract.project)
  contracts!: Contract[];
}
