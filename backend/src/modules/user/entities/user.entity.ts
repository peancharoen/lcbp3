// File: src/modules/user/entities/user.entity.ts
// บันทึกการแก้ไข: เพิ่ม Relations กับ UserAssignment และ UserPreference (T1.3)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity'; // Adjust path as needed
import { UserAssignment } from './user-assignment.entity';
import { UserPreference } from './user-preference.entity';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User extends UuidBaseEntity {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  @Exclude()
  user_id!: number;

  @Column({ unique: true, length: 50 })
  username!: string;

  @Column({ name: 'password_hash', select: false }) // ไม่ Select Password โดย Default
  password!: string;

  @Column({ unique: true, length: 100 })
  email!: string;

  @Column({ name: 'first_name', nullable: true, length: 50 })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true, length: 50 })
  lastName?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  /** SEV-014: บังคับเปลี่ยนรหัสผ่านหลัง login ครั้งแรก (สำหรับ seed users) */
  @Column({ name: 'must_change_password', type: 'tinyint', default: 0 })
  mustChangePassword!: boolean;

  @Column({ name: 'failed_attempts', default: 0 })
  failedAttempts!: number;

  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
  lockedUntil?: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'line_id', nullable: true, length: 100 })
  lineId?: string;

  /** Feature 258: Telegram Chat ID สำหรับส่ง DM — ได้จาก deep-link flow เท่านั้น (UNIQUE ที่ DB level) */
  @Column({
    name: 'telegram_chat_id',
    type: 'varchar',
    nullable: true,
    length: 50,
  })
  @Exclude() // ห้าม expose ใน API response (data-model.md) — expose เฉพาะ linked/username/linkedAt
  telegramChatId?: string | null;

  /** Feature 258: @username สำหรับแสดงผลใน admin — user เปลี่ยนได้ทุกเมื่อ ห้ามใช้เป็น send target */
  @Column({
    name: 'telegram_username',
    type: 'varchar',
    nullable: true,
    length: 100,
  })
  telegramUsername?: string | null;

  /** Feature 258: เวลาที่ผูกบัญชีสำเร็จ — NULL พร้อม chat_id หมายถึง binding ถูกล้าง */
  @Column({ name: 'telegram_linked_at', type: 'timestamp', nullable: true })
  telegramLinkedAt?: Date | null;

  // Relation กับ Organization (สังกัดหลัก)
  @Column({ name: 'primary_organization_id', nullable: true })
  @Exclude() // INT ID - never expose, use primaryOrganizationPublicId instead (ADR-019)
  primaryOrganizationId?: number;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_organization_id' })
  organization?: Organization;

  // ADR-019: Expose UUID instead of INT ID
  get primaryOrganizationPublicId(): string | undefined {
    return this.organization?.publicId;
  }

  // Relation กับ Assignments (RBAC)
  @OneToMany(() => UserAssignment, (assignment) => assignment.user)
  assignments?: UserAssignment[];

  // Relation กับ Preferences (1:1)
  @OneToOne(() => UserPreference, (pref) => pref.user, { cascade: true })
  preference?: UserPreference;

  // Base Entity Fields
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', select: false })
  deletedAt?: Date;
}
