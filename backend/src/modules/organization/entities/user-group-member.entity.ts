// File: backend/src/modules/organization/entities/user-group-member.entity.ts
// Change Log:
// - 2026-10-06: Initial creation — สมาชิกของ user_groups (User Grouping Model)

import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserGroup } from './user-group.entity';
import { User } from '../../user/entities/user.entity';

/**
 * สมาชิกของ user_groups — composite PK (group_id, user_id) ตาม schema
 */
@Entity('user_group_members')
export class UserGroupMember {
  @PrimaryColumn({ name: 'group_id' })
  @Exclude()
  groupId!: number;

  @PrimaryColumn({ name: 'user_id' })
  @Exclude()
  userId!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => UserGroup, (group) => group.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group?: UserGroup;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
