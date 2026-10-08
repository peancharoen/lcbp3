// File: backend/src/modules/notification/entities/notification-channel.entity.ts
// Change Log:
// - 2026-09-25: Initial creation — จุดหมายภายนอกที่ bind ได้ (Telegram group/topic ต่อ project) Feature 258
// - 2026-10-06: User Grouping Model — เพิ่ม scope user_group_id/department_id (ผูก channel ให้กลุ่ม/แผนก)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { Exclude } from 'class-transformer';

export enum NotificationChannelType {
  TELEGRAM_GROUP = 'TELEGRAM_GROUP',
  TELEGRAM_CHANNEL = 'TELEGRAM_CHANNEL',
  LINE = 'LINE',
}

/**
 * External notification channel ที่ bind กับ 1 scope เสมอ — project / user_group / department
 * (ไม่มี global scope: ไม่มี delivery path สำหรับ channel ไม่มี scope — chk_channel_single_scope)
 * `telegramTopicId` = NULL หมายถึงผูกทั้งกลุ่ม (general chat);
 * มีค่า = ผูกเฉพาะ forum topic นั้น (จาก `message_thread_id` ตอน `/link`)
 */
@Entity('notification_channels')
@Index('uk_channel', ['channelType', 'externalChatId', 'telegramTopicId'], {
  unique: true,
})
@Index(['projectId', 'isActive'])
@Index(['userGroupId', 'isActive'])
@Index(['departmentId', 'isActive'])
export class NotificationChannel extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({
    name: 'channel_type',
    type: 'enum',
    enum: NotificationChannelType,
  })
  channelType!: NotificationChannelType;

  /** chat_id ของ group/channel (ติดลบเสมอสำหรับ group) */
  @Column({ name: 'external_chat_id', length: 50 })
  externalChatId!: string;

  @Column({ name: 'project_id', nullable: true })
  @Exclude()
  projectId?: number;

  /** Scope: user_group ที่ผูก (User Grouping Model) — ตั้งได้ 1 ใน project/userGroup/department */
  @Column({ name: 'user_group_id', nullable: true })
  @Exclude()
  userGroupId?: number;

  /** Scope: department ที่ผูก (User Grouping Model) */
  @Column({ name: 'department_id', nullable: true })
  @Exclude()
  departmentId?: number;

  /** ชื่อกลุ่มแสดงใน admin console */
  @Column({ nullable: true, length: 100 })
  name?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  /** Forum Topics: `message_thread_id` ของ topic ที่ผูก — NULL = ทั้งกลุ่ม */
  @Column({ name: 'telegram_topic_id', type: 'int', nullable: true })
  telegramTopicId?: number | null;

  /** เหตุผลล่าสุดที่ส่งไม่สำเร็จ (แสดงใน admin) */
  @Column({ name: 'last_error', type: 'varchar', nullable: true, length: 255 })
  lastError?: string | null;

  /** Transient — scope publicIds ที่ resolve จาก list() สำหรับ admin UI (ไม่ persist) */
  projectPublicId?: string;
  userGroupPublicId?: string;
  departmentPublicId?: string;
  /** Transient — ชื่อ scope ที่ resolve มาแสดง (project name / group name / department name) */
  scopeName?: string;

  @Column({ name: 'created_by', nullable: true })
  @Exclude()
  createdBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
