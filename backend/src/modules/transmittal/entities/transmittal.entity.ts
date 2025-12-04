import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Correspondence } from '../../correspondence/entities/correspondence.entity';
import { TransmittalItem } from './transmittal-item.entity';

@Entity('transmittals')
export class Transmittal {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'correspondence_id', unique: true })
  correspondenceId!: number;

  @Column({ name: 'transmittal_no', length: 100 })
  transmittalNo!: string;

  @Column({ length: 500 })
  subject!: string;

  @Column({
    type: 'enum',
    enum: ['FOR_APPROVAL', 'FOR_INFORMATION', 'FOR_REVIEW', 'OTHER'],
    nullable: true,
  })
  purpose?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @OneToOne(() => Correspondence)
  @JoinColumn({ name: 'correspondence_id' })
  correspondence!: Correspondence;

  @OneToMany(() => TransmittalItem, (item) => item.transmittal, {
    cascade: true,
  })
  items!: TransmittalItem[];
}
