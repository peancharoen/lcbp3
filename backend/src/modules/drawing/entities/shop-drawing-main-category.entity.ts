import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('shop_drawing_main_categories')
export class ShopDrawingMainCategory {
  @PrimaryGeneratedColumn()
  id!: number; // เติม !

  @Column({ name: 'project_id' })
  projectId!: number; // เติม !

  @Column({ name: 'main_category_code', length: 50, unique: true })
  mainCategoryCode!: string; // เติม !

  @Column({ name: 'main_category_name', length: 255 })
  mainCategoryName!: string; // เติม !

  @Column({ type: 'text', nullable: true })
  description?: string; // nullable

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number; // เติม !

  @Column({ name: 'is_active', default: true })
  isActive!: boolean; // เติม !

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date; // เติม !

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date; // เติม !
}
