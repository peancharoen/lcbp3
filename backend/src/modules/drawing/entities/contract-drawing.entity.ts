import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity';
import { User } from '../../user/entities/user.entity';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { ContractDrawingSubCategory } from './contract-drawing-sub-category.entity';
import { ContractDrawingVolume } from './contract-drawing-volume.entity';

@Entity('contract_drawings')
export class ContractDrawing {
  @PrimaryGeneratedColumn()
  id!: number; // ! ห้ามว่าง

  @Column({ name: 'project_id' })
  projectId!: number; // ! ห้ามว่าง

  @Column({ name: 'condwg_no', length: 255 })
  contractDrawingNo!: string; // ! ห้ามว่าง

  @Column({ length: 255 })
  title!: string; // ! ห้ามว่าง

  @Column({ name: 'sub_cat_id', nullable: true })
  subCategoryId?: number; // ? ว่างได้ (Nullable)

  @Column({ name: 'volume_id', nullable: true })
  volumeId?: number; // ? ว่างได้ (Nullable)

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date; // ! ห้ามว่าง

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date; // ! ห้ามว่าง

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date; // ? ว่างได้ (Nullable)

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number; // ? ว่างได้ (Nullable)

  // --- Relations ---

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project!: Project; // ! ห้ามว่าง

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updated_by' })
  updater?: User; // ? ว่างได้

  @ManyToOne(() => ContractDrawingSubCategory)
  @JoinColumn({ name: 'sub_cat_id' })
  subCategory?: ContractDrawingSubCategory; // ? ว่างได้ (สัมพันธ์กับ subCategoryId)

  @ManyToOne(() => ContractDrawingVolume)
  @JoinColumn({ name: 'volume_id' })
  volume?: ContractDrawingVolume; // ? แก้ไขตรงนี้: ใส่ ? เพราะ volumeId เป็น Nullable

  @ManyToMany(() => Attachment)
  @JoinTable({
    name: 'contract_drawing_attachments',
    joinColumn: { name: 'contract_drawing_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'attachment_id', referencedColumnName: 'id' },
  })
  attachments!: Attachment[]; // ! ห้ามว่าง (TypeORM จะ return [] ถ้าไม่มี)
}
