// File: src/modules/master/entities/tag.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true, comment: 'ชื่อ Tag' })
  tag_name: string;

  @Column({ type: 'text', nullable: true, comment: 'คำอธิบายแท็ก' })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
