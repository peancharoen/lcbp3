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

@Entity('rfas')
export class Rfa {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rfa_number', length: 50, unique: true })
  rfaNumber!: string;

  @Column({ length: 255 })
  title!: string;

  @Column({ name: 'discipline_code', length: 20, nullable: true })
  disciplineCode!: string;

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
