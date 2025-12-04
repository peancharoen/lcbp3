import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('correspondences')
export class Correspondence {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'document_number', length: 50, unique: true })
  documentNumber!: string;

  @Column({ length: 255 })
  subject!: string;

  @Column({ type: 'text', nullable: true })
  body!: string;

  @Column({ length: 50 })
  type!: string;

  @Column({ length: 50, default: 'Draft' })
  status!: string;

  @Column({ name: 'created_by_id' })
  createdById!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
