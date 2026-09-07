import {
  Entity,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
  PrimaryColumn,
  VersionColumn,
  ManyToOne,
} from 'typeorm';
import { Correspondence } from '../../correspondence/entities/correspondence.entity';
import { CorrespondenceStatus } from '../../correspondence/entities/correspondence-status.entity';
import { User } from '../../user/entities/user.entity';
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

  @VersionColumn({ name: 'version', default: 0 })
  version!: number;

  @Column({ name: 'status_id', nullable: true })
  statusId?: number;

  @Column({
    name: 'cancel_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  cancelReason?: string;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt?: Date;

  @Column({ name: 'cancelled_by', nullable: true })
  cancelledBy?: number;

  // Relations
  @OneToOne(() => Correspondence)
  @JoinColumn({ name: 'correspondence_id' })
  correspondence!: Correspondence;

  @OneToMany(() => TransmittalItem, (item) => item.transmittal, {
    cascade: true,
  })
  items!: TransmittalItem[];

  @ManyToOne(() => CorrespondenceStatus)
  @JoinColumn({ name: 'status_id' })
  status?: CorrespondenceStatus;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'cancelled_by' })
  canceller?: User;
}
