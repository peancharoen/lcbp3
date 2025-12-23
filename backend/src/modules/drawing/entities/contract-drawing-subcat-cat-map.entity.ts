import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity';
import { ContractDrawingCategory } from './contract-drawing-category.entity';
import { ContractDrawingSubCategory } from './contract-drawing-sub-category.entity';

@Entity('contract_drawing_subcat_cat_maps')
export class ContractDrawingSubcatCatMap {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id', nullable: true })
  projectId?: number;

  @Column({ name: 'sub_cat_id', nullable: true })
  subCategoryId?: number;

  @Column({ name: 'cat_id', nullable: true })
  categoryId?: number;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @ManyToOne(() => ContractDrawingSubCategory)
  @JoinColumn({ name: 'sub_cat_id' })
  subCategory?: ContractDrawingSubCategory;

  @ManyToOne(() => ContractDrawingCategory)
  @JoinColumn({ name: 'cat_id' })
  category?: ContractDrawingCategory;
}
