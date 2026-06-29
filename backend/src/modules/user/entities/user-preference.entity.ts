// File: src/modules/user/entities/user-preference.entity.ts
// บันทึกการแก้ไข: Entity สำหรับเก็บการตั้งค่าส่วนตัวของผู้ใช้ แยกจากตาราง Users (T1.3)

import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryColumn({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'notify_email', default: true })
  notifyEmail!: boolean;

  @Column({ name: 'notify_line', default: true })
  notifyLine!: boolean;

  @Column({ name: 'digest_mode', default: false })
  digestMode!: boolean; // รับแจ้งเตือนแบบรวม (Digest) แทน Real-time

  @Column({ name: 'ui_theme', default: 'light', length: 20 })
  uiTheme!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // --- Relation ---
  @OneToOne(() => User, (user) => user.preference, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
