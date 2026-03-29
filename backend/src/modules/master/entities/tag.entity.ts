import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity';

@Entity('tags')
@Unique('ux_tag_project', ['projectId', 'tagName'])
export class Tag {
  @PrimaryGeneratedColumn()
  id!: number; // เพิ่ม !

  @Column({ name: 'project_id', type: 'int', nullable: true })
  projectId!: number | null; // เพิ่ม !

  @Column({ name: 'tag_name', length: 100 })
  tagName!: string; // เพิ่ม !

  @Column({ name: 'color_code', length: 30, default: 'default' })
  colorCode!: string; // เพิ่ม !

  @Column({ type: 'text', nullable: true })
  description!: string | null; // เพิ่ม !

  // Relations
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date; // เพิ่ม !

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date; // เพิ่ม !

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null; // เพิ่ม !

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null; // เพิ่ม !
}
