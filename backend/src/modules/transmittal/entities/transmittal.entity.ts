import {
  Entity,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { Correspondence } from '../../correspondence/entities/correspondence.entity';
import { TransmittalItem } from './transmittal-item.entity';

@Entity('transmittals')
export class Transmittal {
  @PrimaryColumn({ name: 'correspondence_id' })
  correspondenceId!: number;

  @Column({
    type: 'enum',
    enum: ['FOR_APPROVAL', 'FOR_INFORMATION', 'FOR_REVIEW', 'OTHER'],
    nullable: true,
  })
  purpose?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  // Relations
  @OneToOne(() => Correspondence)
  @JoinColumn({ name: 'correspondence_id' })
  correspondence!: Correspondence;

  @OneToMany(() => TransmittalItem, (item) => item.transmittal, {
    cascade: true,
  })
  items!: TransmittalItem[];
}
