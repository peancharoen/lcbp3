// File: src/modules/notification/notification.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entities
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../user/entities/user.entity';
import { UserPreference } from '../user/entities/user-preference.entity';

// Gateway
import { NotificationGateway } from './notification.gateway';

// DTOs
import { SearchNotificationDto } from './dto/search-notification.dto';

// Interfaces
export interface NotificationJobData {
  userId: number;
  title: string;
  message: string;
  type: 'EMAIL' | 'LINE' | 'SYSTEM'; // ช่องทางหลักที่ต้องการส่ง (Trigger Type)
  entityType?: string;
  entityId?: number;
  link?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue('notifications') private notificationQueue: Queue,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    // ไม่ต้อง Inject UserPrefRepo แล้ว เพราะ Processor จะจัดการเอง
    private notificationGateway: NotificationGateway,
  ) {}

  /**
   * ส่งการแจ้งเตือน (Centralized Notification Sender)
   */
  async send(data: NotificationJobData): Promise<void> {
    try {
      // ---------------------------------------------------------
      // 1. สร้าง Entity และบันทึกลง DB (System Log)
      // ---------------------------------------------------------
      const notification = this.notificationRepo.create({
        userId: data.userId,
        title: data.title,
        message: data.message,
        notificationType: NotificationType.SYSTEM,
        entityType: data.entityType,
        entityId: data.entityId,
        isRead: false,
      });

      const savedNotification = await this.notificationRepo.save(notification);

      // ---------------------------------------------------------
      // 2. Real-time Push (WebSocket)
      // ---------------------------------------------------------
      this.notificationGateway.sendToUser(data.userId, savedNotification);

      // ---------------------------------------------------------
      // 3. Push Job ลง Redis BullMQ (Dispatch Logic)
      // เปลี่ยนชื่อ Job เป็น 'dispatch-notification' ตาม Processor
      // ---------------------------------------------------------
      await this.notificationQueue.add(
        'dispatch-notification',
        {
          ...data,
          notificationId: savedNotification.id, // ส่ง ID ไปด้วยเผื่อใช้ Tracking
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
        },
      );

      this.logger.debug(`Dispatched notification job for user ${data.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process notification for user ${data.userId}`,
        (error as Error).stack,
      );
    }
  }

  // ... (ส่วน findAll, markAsRead, cleanupOldNotifications เหมือนเดิม ไม่ต้องแก้) ...

  async findAll(userId: number, searchDto: SearchNotificationDto) {
    const { page = 1, limit = 20, isRead } = searchDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .take(limit)
      .skip(skip);

    if (isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead });
    }

    const [items, total] = await queryBuilder.getManyAndCount();
    const unreadCount = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  /**
   * ดึงจำนวน Notification ที่ยังไม่ได้อ่าน
   */
  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: number, userId: number): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification #${id} not found`);
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await this.notificationRepo.save(notification);
    }
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async cleanupOldNotifications(days: number = 90): Promise<number> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const result = await this.notificationRepo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('createdAt < :dateLimit', { dateLimit })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} old notifications`);
    return result.affected ?? 0;
  }
}
