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
  id!: number; // เพิ่ม !

  @Column({ length: 100, unique: true })
  tag_name!: string; // เพิ่ม !

  @Column({ type: 'text', nullable: true })
  description!: string; // เพิ่ม !

  @CreateDateColumn()
  created_at!: Date; // เพิ่ม !

  @UpdateDateColumn()
  updated_at!: Date; // เพิ่ม !
}
