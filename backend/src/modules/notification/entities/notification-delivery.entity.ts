// File: backend/src/modules/notification/entities/notification-delivery.entity.ts
// Change Log:
// - 2026-09-25: Initial creation — audit trail ทุก send attempt (FR-009) Feature 258
//   ตารางนี้ PARTITION BY RANGE (YEAR(created_at)) — uuid ไม่มี UNIQUE constraint ที่ DB
//   (MariaDB: UNIQUE index บน partitioned table ต้องมี partition key รวมอยู่)
//   uniqueness ของ uuid บังคับที่ application layer (uuidv7 collision แทบเป็นไปไม่ได้)

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  PrimaryColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Exclude } from 'class-transformer';
import { NotificationType } from './notification.entity';

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

/**
 * Audit row ต่อ send attempt — ครอบคลุมทั้ง DM (มี notificationId) และ group post
 * Composite PK (id, createdAt) ตาม pattern ของ `notifications` (partitioned table)
 */
@Entity('notification_deliveries')
@Index(['channelType', 'status'])
@Index(['channelId'])
@Index(['target'])
@Index(['entityType', 'entityId'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  @Exclude()
  id!: number;

  /** publicId (ADR-019) — index ธรรมดา ไม่ unique (partition constraint) */
  @Index()
  @Column({ type: 'uuid', name: 'uuid' })
  publicId!: string;

  /** notifications.id ถ้าเป็น user DM (ไม่ใส่ FK — notifications เป็น partitioned table) */
  @Column({ name: 'notification_id', nullable: true })
  @Exclude()
  notificationId?: number;

  @Column({
    name: 'channel_type',
    type: 'enum',
    enum: NotificationType,
  })
  channelType!: NotificationType;

  /** chat_id / email / line id ปลายทาง (ไม่เก็บเนื้อข้อความ) */
  @Column({ length: 100 })
  target!: string;

  /** notification_channels.id ถ้าส่งผ่าน bound channel — plain index (no FK on partitioned) */
  @Column({ name: 'channel_id', nullable: true })
  @Exclude()
  channelId?: number | null;

  @Column({ name: 'event_type', length: 50 })
  eventType!: string;

  @Column({ name: 'entity_type', length: 50, nullable: true })
  entityType?: string;

  /** entity publicId (ADR-019 — VARCHAR ไม่ใช่ INT) */
  @Column({ name: 'entity_id', length: 50, nullable: true })
  entityId?: string;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status!: DeliveryStatus;

  @Column({ name: 'error_code', length: 50, nullable: true })
  errorCode?: string;

  @Column({ name: 'error_message', length: 500, nullable: true })
  errorMessage?: string;

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount!: number;

  /** BullMQ job id */
  @Column({ name: 'queued_job_id', length: 64, nullable: true })
  queuedJobId?: string;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  @PrimaryColumn()
  createdAt!: Date;

  @BeforeInsert()
  generatePublicId(): void {
    if (!this.publicId) {
      this.publicId = uuidv7();
    }
  }
}
