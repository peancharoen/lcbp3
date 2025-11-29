import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Discipline } from '../../master/entities/discipline.entity'; // Import ใหม่
import { User } from '../../user/entities/user.entity';
import { RfaRevision } from './rfa-revision.entity';
import { RfaType } from './rfa-type.entity';

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

  // ✅ [NEW] Relation
  @ManyToOne(() => Discipline)
  @JoinColumn({ name: 'discipline_id' })
  discipline?: Discipline;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @OneToMany(() => RfaRevision, (revision) => revision.rfa)
  revisions!: RfaRevision[];
}
