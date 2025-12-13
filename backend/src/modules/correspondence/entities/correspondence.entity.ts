import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  DeleteDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { CorrespondenceType } from './correspondence-type.entity';
import { User } from '../../user/entities/user.entity';
import { CorrespondenceRecipient } from './correspondence-recipient.entity';
import { CorrespondenceRevision } from './correspondence-revision.entity';
import { Discipline } from '../../master/entities/discipline.entity';

@Entity('correspondences')
export class Correspondence {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'correspondence_number', length: 100 })
  correspondenceNumber!: string;

  @Column({ name: 'correspondence_type_id' })
  correspondenceTypeId!: number;

  @Column({ name: 'discipline_id', nullable: true })
  disciplineId?: number;

  @Column({ name: 'project_id' })
  projectId!: number;

  @Column({ name: 'originator_id', nullable: true })
  originatorId?: number;

  @Column({
    name: 'is_internal_communication',
    default: false,
    type: 'tinyint',
  })
  isInternal!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @DeleteDateColumn({ name: 'deleted_at', select: false })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => CorrespondenceType)
  @JoinColumn({ name: 'correspondence_type_id' })
  type?: CorrespondenceType;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'originator_id' })
  originator?: Organization;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  // [New V1.5.1]
  @ManyToOne(() => Discipline)
  @JoinColumn({ name: 'discipline_id' })
  discipline?: Discipline;

  // One Correspondence has Many Revisions
  @OneToMany(
    () => CorrespondenceRevision,
    (revision) => revision.correspondence
  )
  revisions?: CorrespondenceRevision[];

  @OneToMany(
    () => CorrespondenceRecipient,
    (recipient) => recipient.correspondence,
    { cascade: true }
  )
  recipients?: CorrespondenceRecipient[];
}
