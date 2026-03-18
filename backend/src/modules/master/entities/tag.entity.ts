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
@Unique('ux_tag_project', ['project_id', 'tag_name'])
export class Tag {
  @PrimaryGeneratedColumn()
  id!: number; // เพิ่ม !

  @Column({ type: 'int', nullable: true })
  project_id!: number | null; // เพิ่ม !

  @Column({ length: 100 })
  tag_name!: string; // เพิ่ม !

  @Column({ length: 30, default: 'default' })
  color_code!: string; // เพิ่ม !

  @Column({ type: 'text', nullable: true })
  description!: string | null; // เพิ่ม !

  // Relations
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @CreateDateColumn()
  created_at!: Date; // เพิ่ม !

  @UpdateDateColumn()
  updated_at!: Date; // เพิ่ม !

  @Column({ type: 'int', nullable: true })
  created_by!: number | null; // เพิ่ม !

  @DeleteDateColumn()
  deleted_at!: Date | null; // เพิ่ม !
}
