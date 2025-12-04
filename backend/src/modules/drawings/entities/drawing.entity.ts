import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('drawings')
export class Drawing {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'drawing_number', length: 50, unique: true })
  drawingNumber!: string;

  @Column({ length: 255 })
  title!: string;

  @Column({ name: 'drawing_type', length: 50 })
  drawingType!: string;

  @Column({ length: 10 })
  revision!: string;

  @Column({ length: 50, default: 'Draft' })
  status!: string;

  @Column({ name: 'uploaded_by_id' })
  uploadedById!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
