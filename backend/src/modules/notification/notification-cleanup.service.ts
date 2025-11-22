import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
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
      const result = await this.notificationRepo.delete({
        isRead: true,
        createdAt: LessThan(dateThreshold),
      });

      this.logger.log(`Deleted ${result.affected} old read notifications.`);
    } catch (error) {
      this.logger.error('Failed to cleanup notifications', error);
    }
  }
}
