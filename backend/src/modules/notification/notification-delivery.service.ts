// File: backend/src/modules/notification/notification-delivery.service.ts
// Change Log:
// - 2026-09-25: Initial creation (T053) — delivery audit read/write API (Feature 258 US4, FR-009/010)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  Between,
  MoreThanOrEqual,
} from 'typeorm';

import {
  NotificationDelivery,
  DeliveryStatus,
} from './entities/notification-delivery.entity';
import { NotificationType } from './entities/notification.entity';

/** Permanent Telegram error codes — ไม่ retry, flag binding/channel ว่า unreachable */
export const PERMANENT_DELIVERY_CODES = [
  'BOT_BLOCKED',
  'CHAT_NOT_FOUND',
  'TELEGRAM_DISABLED',
  'BOT_TOKEN_MISSING',
] as const;

export interface DeliveryListFilter {
  channelType?: NotificationType;
  status?: DeliveryStatus;
  target?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface CreateDeliveryData {
  channelType: NotificationType;
  target: string;
  eventType: string;
  channelId?: number;
  notificationId?: number;
  entityType?: string;
  entityId?: string;
}

/**
 * จัดการ notification_deliveries — audit trail ทุก send attempt
 * (ไม่มี FK ไป notifications/channels — partitioned table, app-level consistency)
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>
  ) {}

  /** สร้าง delivery row สถานะ PENDING ก่อน enqueue/send */
  async record(data: CreateDeliveryData): Promise<NotificationDelivery> {
    return this.deliveryRepo.save(
      this.deliveryRepo.create({ ...data, status: DeliveryStatus.PENDING })
    );
  }

  /** ส่งสำเร็จ */
  async markSent(publicId: string): Promise<void> {
    await this.deliveryRepo.update(
      { publicId },
      { status: DeliveryStatus.SENT, sentAt: new Date() }
    );
  }

  /** ส่งล้มเหลว — เก็บ code/message สำหรับ observability */
  async markFailed(
    publicId: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    await this.deliveryRepo.update(
      { publicId },
      {
        status: DeliveryStatus.FAILED,
        errorCode,
        errorMessage: errorMessage.slice(0, 500),
      }
    );
  }

  /** ข้ามการส่ง (recipient ปิดรับ/ไม่มี binding) */
  async markSkipped(publicId: string, reason: string): Promise<void> {
    await this.deliveryRepo.update(
      { publicId },
      {
        status: DeliveryStatus.SKIPPED,
        errorCode: 'SKIPPED',
        errorMessage: reason.slice(0, 500),
      }
    );
  }

  /** Transient failure — เพิ่ม attempt counter ก่อน BullMQ retry */
  async recordAttempt(publicId: string, errorMessage: string): Promise<void> {
    await this.deliveryRepo
      .createQueryBuilder()
      .update()
      .set({
        attemptCount: () => 'attempt_count + 1',
        errorMessage: errorMessage.slice(0, 500),
      })
      .where('uuid = :id', { id: publicId })
      .execute();
  }

  /** error code นี้เป็น permanent หรือไม่ (ไม่ควร retry/flag unreachable) */
  isPermanentCode(errorCode: string): boolean {
    return (PERMANENT_DELIVERY_CODES as readonly string[]).includes(errorCode);
  }

  /** Admin list — filter ตาม channelType/status/target/chunk วันที่ */
  async list(
    filter: DeliveryListFilter
  ): Promise<{ items: NotificationDelivery[]; total: number }> {
    const where: FindOptionsWhere<NotificationDelivery> = {};
    if (filter.channelType) where.channelType = filter.channelType;
    if (filter.status) where.status = filter.status;
    if (filter.target) where.target = filter.target;
    if (filter.from && filter.to) {
      where.createdAt = Between(filter.from, filter.to);
    } else if (filter.from) {
      where.createdAt = MoreThanOrEqual(filter.from);
    }

    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 50, 100);
    const [items, total] = await this.deliveryRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  /** ดึง delivery จาก publicId (ใช้ภายใน — เช่นหา channelId ตอน flag inactive) */
  async findByPublicId(publicId: string): Promise<NotificationDelivery | null> {
    return this.deliveryRepo.findOne({ where: { publicId } });
  }
}
