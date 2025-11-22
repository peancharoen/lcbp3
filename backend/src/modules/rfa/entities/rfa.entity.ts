import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { RfaType } from './rfa-type.entity';
import { User } from '../../user/entities/user.entity';
import { RfaRevision } from './rfa-revision.entity';

@Entity('rfas')
export class Rfa {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rfa_type_id' })
  rfaTypeId!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => RfaType)
  @JoinColumn({ name: 'rfa_type_id' })
  rfaType!: RfaType;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @OneToMany(() => RfaRevision, (revision) => revision.rfa)
  revisions!: RfaRevision[];
}
