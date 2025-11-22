import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Transmittal } from './transmittal.entity';
import { Correspondence } from '../../correspondence/entities/correspondence.entity';

@Entity('transmittal_items')
export class TransmittalItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'transmittal_id' })
  transmittalId!: number;

  @Column({ name: 'item_correspondence_id' })
  itemCorrespondenceId!: number;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ length: 255, nullable: true })
  remarks?: string;

  // Relations
  @ManyToOne(() => Transmittal, (t) => t.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transmittal_id' })
  transmittal!: Transmittal;

  @ManyToOne(() => Correspondence)
  @JoinColumn({ name: 'item_correspondence_id' })
  itemDocument!: Correspondence;
}
