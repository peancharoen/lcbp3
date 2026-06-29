// File: src/modules/review-team/entities/review-team-member.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { User } from '../../user/entities/user.entity';
import { Discipline } from '../../master/entities/discipline.entity';
import { ReviewTeam } from './review-team.entity';
import { ReviewTeamMemberRole } from '../../common/enums/review.enums';

@Entity('review_team_members')
export class ReviewTeamMember extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'team_id' })
  @Exclude()
  teamId!: number;

  @Column({ name: 'user_id' })
  @Exclude()
  userId!: number;

  @Column({ name: 'discipline_id' })
  @Exclude()
  disciplineId!: number;

  @Column({
    type: 'enum',
    enum: ReviewTeamMemberRole,
    default: ReviewTeamMemberRole.REVIEWER,
  })
  role!: ReviewTeamMemberRole;

  @Column({ name: 'priority_order', default: 0 })
  priorityOrder!: number; // สำหรับ fallback sequential assignment

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => ReviewTeam, (team: ReviewTeam) => team.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'team_id' })
  team!: ReviewTeam;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Discipline)
  @JoinColumn({ name: 'discipline_id' })
  discipline?: Discipline;
}
