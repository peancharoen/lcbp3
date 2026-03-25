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

  @Column({ type: 'int', nullable: true })
  projectId!: number | null; // เพิ่ม !

  @Column({ length: 100 })
  tagName!: string; // เพิ่ม !

  @Column({ length: 30, default: 'default' })
  colorCode!: string; // เพิ่ม !

  @Column({ type: 'text', nullable: true })
  description!: string | null; // เพิ่ม !

  // Relations
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @CreateDateColumn()
  createdAt!: Date; // เพิ่ม !

  @UpdateDateColumn()
  updatedAt!: Date; // เพิ่ม !

  @Column({ type: 'int', nullable: true })
  createdBy!: number | null; // เพิ่ม !

  @DeleteDateColumn()
  deletedAt!: Date | null; // เพิ่ม !
}
