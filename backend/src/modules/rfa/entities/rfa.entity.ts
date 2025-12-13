import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  OneToOne,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { Correspondence } from '../../correspondence/entities/correspondence.entity'; // Import
import { RfaRevision } from './rfa-revision.entity';
import { RfaType } from './rfa-type.entity';

@Entity('rfas')
export class Rfa {
  @PrimaryColumn()
  id!: number;

  @OneToOne(() => Correspondence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  correspondence!: Correspondence;

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
