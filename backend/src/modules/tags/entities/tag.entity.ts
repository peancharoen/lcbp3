// File: src/modules/tags/entities/tag.entity.ts
// Change Log:
// - 2026-05-22: สร้างเอนทิตี Tag สำหรับเป็นตัวแทนตาราง tags ในฐานข้อมูล (ADR-028)
// - 2026-09-01: Consolidate — ย้าย project relation จาก master/entities/tag.entity.ts มาที่นี่
//   เพื่อให้มี entity เดียวสำหรับตาราง tags (ลด duplicate entity conflict ใน TypeORM)

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Project } from '../../project/entities/project.entity';
import { v7 as uuidv7 } from 'uuid';

/**
 * เอนทิตี Tag สำหรับเก็บข้อมูลแท็กที่ใช้ในการจัดหมวดหมู่เอกสารโต้ตอบ
 */
@Entity('tags')
export class Tag extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({
    type: 'char',
    length: 36,
    name: 'public_id',
    unique: true,
    nullable: false,
    comment: 'UUIDv7 สำหรับส่งออกไปนอก API (ADR-019)',
  })
  publicId!: string;

  @Column({ name: 'project_id', type: 'int', nullable: true })
  projectId!: number | null;

  @Column({ name: 'tag_name', type: 'varchar', length: 100, nullable: false })
  tagName!: string;

  @Column({
    name: 'color_code',
    type: 'varchar',
    length: 30,
    default: 'default',
  })
  colorCode!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  // Relations (consolidated from master/entities/tag.entity.ts)
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @BeforeInsert()
  generatePublicId(): void {
    if (!this.publicId) {
      this.publicId = uuidv7();
    }
  }
}
