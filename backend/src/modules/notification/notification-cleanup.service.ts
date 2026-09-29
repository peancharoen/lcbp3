// File: backend/src/modules/notification/notification-cleanup.service.ts
// Change Log:
// - 2026-09-25: Feature 258 (T053a) — เพิ่ม 90-day retention cleanup สำหรับ notification_deliveries

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';

@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationDelivery)
    private deliveryRepo: Repository<NotificationDelivery>
  ) {}

  /**
   * ลบแจ้งเตือนที่ "อ่านแล้ว" และเก่ากว่า 30 วัน
   * รันทุกวันเวลาเที่ยงคืน
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCleanup() {
    this.logger.log('Running notification cleanup...');

    const daysAgo = 30;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysAgo);

    try {
      const result = await this.notificationRepo
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where('is_read = :isRead', { isRead: true })
        // Use column name 'created_at' explicitly
        .andWhere('created_at < :dateThreshold', { dateThreshold })
        .execute();

      this.logger.log(`Deleted ${result.affected} old read notifications.`);
    } catch (error) {
      this.logger.error('Failed to cleanup notifications', error);
    }
  }

  /**
   * ลบ delivery audit rows ที่เก่ากว่า 90 วัน (Feature 258, D11f)
   * รันทุกวันเวลาเที่ยงคืน — deliveries เป็น append-only audit, retention 90 วัน
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDeliveryCleanup() {
    this.logger.log(
      'Running notification_deliveries cleanup (90-day retention)...'
    );

    const daysAgo = 90;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysAgo);

    try {
      const result = await this.deliveryRepo
        .createQueryBuilder()
        .delete()
        .from(NotificationDelivery)
        .where('created_at < :dateThreshold', { dateThreshold })
        .execute();

      this.logger.log(
        `Deleted ${result.affected ?? 0} old notification_deliveries rows.`
      );
    } catch (error) {
      this.logger.error('Failed to cleanup notification_deliveries', error);
    }
  }
}
