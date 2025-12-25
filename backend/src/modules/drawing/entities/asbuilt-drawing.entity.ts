import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity';
import { AsBuiltDrawingRevision } from './asbuilt-drawing-revision.entity';
import { User } from '../../user/entities/user.entity';
import { ShopDrawingMainCategory } from './shop-drawing-main-category.entity';
import { ShopDrawingSubCategory } from './shop-drawing-sub-category.entity';

@Entity('asbuilt_drawings')
export class AsBuiltDrawing {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id' })
  projectId!: number;

  @Column({ name: 'drawing_number', length: 100, unique: true })
  drawingNumber!: string;

  @Column({ name: 'main_category_id' })
  mainCategoryId!: number;

  @Column({ name: 'sub_category_id' })
  subCategoryId!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number;

  // Relations
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @ManyToOne(() => ShopDrawingMainCategory)
  @JoinColumn({ name: 'main_category_id' })
  mainCategory!: ShopDrawingMainCategory;

  @ManyToOne(() => ShopDrawingSubCategory)
  @JoinColumn({ name: 'sub_category_id' })
  subCategory!: ShopDrawingSubCategory;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updated_by' })
  updater?: User;

  @OneToMany(
    () => AsBuiltDrawingRevision,
    (revision) => revision.asBuiltDrawing,
    {
      cascade: true,
    }
  )
  revisions!: AsBuiltDrawingRevision[];
}
