import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('shop_drawing_sub_categories')
export class ShopDrawingSubCategory {
  @PrimaryGeneratedColumn()
  id!: number; // เติม ! (ตัวที่ error)

  @Column({ name: 'project_id' })
  projectId!: number; // เติม !

  @Column({ name: 'sub_category_code', length: 50, unique: true })
  subCategoryCode!: string; // เติม !

  @Column({ name: 'sub_category_name', length: 255 })
  subCategoryName!: string; // เติม !

  @Column({ type: 'text', nullable: true })
  description?: string; // nullable ใช้ ?

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number; // เติม !

  @Column({ name: 'is_active', default: true })
  isActive!: boolean; // เติม !

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date; // เติม !

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date; // เติม !
}
