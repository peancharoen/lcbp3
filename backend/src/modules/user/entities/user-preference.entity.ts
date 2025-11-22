import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_preferences')
export class UserPreference {
  // ใช้ user_id เป็น Primary Key และ Foreign Key ในตัวเดียวกัน (1:1 Relation)
  @PrimaryColumn({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'notify_email', default: true })
  notifyEmail!: boolean;

  @Column({ name: 'notify_line', default: true })
  notifyLine!: boolean;

  @Column({ name: 'digest_mode', default: true })
  digestMode!: boolean; // รับแจ้งเตือนแบบรวม (Digest) แทน Real-time

  @Column({ name: 'ui_theme', length: 20, default: 'light' })
  uiTheme!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // --- Relations ---

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
