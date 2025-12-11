import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Correspondence } from '../../correspondence/entities/correspondence.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../user/entities/user.entity';
import { CirculationStatusCode } from './circulation-status-code.entity';
import { CirculationRouting } from './circulation-routing.entity';

@Entity('circulations')
export class Circulation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'correspondence_id', nullable: true })
  correspondenceId?: number;

  @Column({ name: 'organization_id' })
  organizationId!: number;

  @Column({ name: 'circulation_no', length: 100 })
  circulationNo!: string;

  @Column({ name: 'circulation_subject', length: 500 })
  subject!: string;

  @Column({ name: 'circulation_status_code' })
  statusCode!: string;

  @Column({ name: 'created_by_user_id' })
  createdByUserId!: number;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Correspondence)
  @JoinColumn({ name: 'correspondence_id' })
  correspondence?: Correspondence;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => CirculationStatusCode)
  @JoinColumn({ name: 'circulation_status_code', referencedColumnName: 'code' })
  status!: CirculationStatusCode;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_user_id' })
  creator!: User;

  @OneToMany(() => CirculationRouting, (routing) => routing.circulation, {
    cascade: true,
  })
  routings!: CirculationRouting[];
}
