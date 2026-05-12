// File: src/modules/review-team/entities/review-team.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { Project } from '../../project/entities/project.entity';
import { ReviewTeamMember } from './review-team-member.entity';

@Entity('review_teams')
export class ReviewTeam extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'project_id' })
  @Exclude()
  projectId!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 255, nullable: true })
  description?: string;

  @Column({ name: 'default_for_rfa_types', type: 'simple-array', nullable: true })
  defaultForRfaTypes?: string[]; // Auto-assign ให้ RFA type เช่น ['SDW','DDW']

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @OneToMany(() => ReviewTeamMember, (member: ReviewTeamMember) => member.team, { cascade: true })
  members?: ReviewTeamMember[];
}
