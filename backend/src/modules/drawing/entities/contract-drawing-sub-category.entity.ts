import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity';

@Entity('contract_drawing_sub_cats')
export class ContractDrawingSubCategory {
  @PrimaryGeneratedColumn()
  id!: number; // เติม !

  @Column({ name: 'project_id' })
  projectId!: number; // เติม !

  @Column({ name: 'sub_cat_code', length: 50 })
  subCatCode!: string; // เติม !

  @Column({ name: 'sub_cat_name', length: 255 })
  subCatName!: string; // เติม !

  @Column({ type: 'text', nullable: true })
  description?: string; // Nullable ใช้ ?

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number; // เติม !

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date; // เติม !

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date; // เติม !

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project!: Project; // เติม !
}
