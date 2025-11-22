import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ShopDrawingRevision } from './shop-drawing-revision.entity';
import { Project } from '../../project/entities/project.entity';
import { ShopDrawingMainCategory } from './shop-drawing-main-category.entity';
import { ShopDrawingSubCategory } from './shop-drawing-sub-category.entity';

@Entity('shop_drawings')
export class ShopDrawing {
  @PrimaryGeneratedColumn()
  id!: number; // เติม !

  @Column({ name: 'project_id' })
  projectId!: number; // เติม !

  @Column({ name: 'drawing_number', length: 100, unique: true })
  drawingNumber!: string; // เติม !

  @Column({ length: 500 })
  title!: string; // เติม !

  @Column({ name: 'main_category_id' })
  mainCategoryId!: number; // เติม !

  @Column({ name: 'sub_category_id' })
  subCategoryId!: number; // เติม !

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date; // เติม !

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date; // เติม !

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date; // nullable

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number; // nullable

  // --- Relations ---

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project!: Project; // เติม ! (ตัวที่ error)

  @ManyToOne(() => ShopDrawingMainCategory)
  @JoinColumn({ name: 'main_category_id' })
  mainCategory!: ShopDrawingMainCategory; // เติม !

  @ManyToOne(() => ShopDrawingSubCategory)
  @JoinColumn({ name: 'sub_category_id' })
  subCategory!: ShopDrawingSubCategory; // เติม !

  @OneToMany(() => ShopDrawingRevision, (revision) => revision.shopDrawing, {
    cascade: true,
  })
  revisions!: ShopDrawingRevision[]; // เติม !
}
