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
  entityType?: string; // e.g., 'rfa', 'correspondence'
  entityId?: number; // e.g., rfa_id
  link?: string; // Deep link to frontend page
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
    @InjectRepository(UserPreference)
    private userPrefRepo: Repository<UserPreference>,
    private notificationGateway: NotificationGateway,
  ) {}

  /**
   * ส่งการแจ้งเตือน (Centralized Notification Sender)
   * 1. บันทึก DB (System Log)
   * 2. ส่ง Real-time (WebSocket)
   * 3. ส่ง External (Email/Line) ผ่าน Queue ตาม User Preference
   */
  async send(data: NotificationJobData): Promise<void> {
    try {
      // ---------------------------------------------------------
      // 1. สร้าง Entity และบันทึกลง DB (เพื่อให้มี History ในระบบ)
      // ---------------------------------------------------------
      const notification = this.notificationRepo.create({
        userId: data.userId,
        title: data.title,
        message: data.message,
        notificationType: NotificationType.SYSTEM, // ใน DB เก็บเป็น SYSTEM เสมอเพื่อแสดงใน App
        entityType: data.entityType,
        entityId: data.entityId,
        isRead: false,
        // link: data.link // ถ้า Entity มี field link ให้ใส่ด้วย
      });

      const savedNotification = await this.notificationRepo.save(notification);

      // ---------------------------------------------------------
      // 2. Real-time Push (WebSocket) -> ส่งให้ User ทันทีถ้า Online
      // ---------------------------------------------------------
      this.notificationGateway.sendToUser(data.userId, savedNotification);

      // ---------------------------------------------------------
      // 3. ตรวจสอบ User Preferences เพื่อส่งช่องทางอื่น (Email/Line)
      // ---------------------------------------------------------
      const userPref = await this.userPrefRepo.findOne({
        where: { userId: data.userId },
      });

      // ใช้ Nullish Coalescing Operator (??)
      // ถ้าไม่มีค่า (undefined/null) ให้ Default เป็น true
      const shouldSendEmail = userPref?.notifyEmail ?? true;
      const shouldSendLine = userPref?.notifyLine ?? true;

      const jobs = [];

      // ---------------------------------------------------------
      // 4. เตรียม Job สำหรับ Email Queue
      // เงื่อนไข: User เปิดรับ Email และ Noti นี้ไม่ได้บังคับส่งแค่ LINE
      // ---------------------------------------------------------
      if (shouldSendEmail && data.type !== 'LINE') {
        jobs.push({
          name: 'send-email',
          data: {
            ...data,
            notificationId: savedNotification.id,
            target: 'EMAIL',
          },
          opts: {
            attempts: 3, // ลองใหม่ 3 ครั้งถ้าล่ม (Resilience)
            backoff: {
              type: 'exponential',
              delay: 5000, // รอ 5s, 10s, 20s...
            },
            removeOnComplete: true, // ลบ Job เมื่อเสร็จ (ประหยัด Redis Memory)
          },
        });
      }

      // ---------------------------------------------------------
      // 5. เตรียม Job สำหรับ Line Queue
      // เงื่อนไข: User เปิดรับ Line และ Noti นี้ไม่ได้บังคับส่งแค่ EMAIL
      // ---------------------------------------------------------
      if (shouldSendLine && data.type !== 'EMAIL') {
        jobs.push({
          name: 'send-line',
          data: {
            ...data,
            notificationId: savedNotification.id,
            target: 'LINE',
          },
          opts: {
            attempts: 3,
            backoff: { type: 'fixed', delay: 3000 },
            removeOnComplete: true,
          },
        });
      }

      // ---------------------------------------------------------
      // 6. Push Jobs ลง Redis BullMQ
      // ---------------------------------------------------------
      if (jobs.length > 0) {
        await this.notificationQueue.addBulk(jobs);
        this.logger.debug(
          `Queued ${jobs.length} external notifications for user ${data.userId}`,
        );
      }
    } catch (error) {
      // Error Handling: ไม่ Throw เพื่อไม่ให้ Flow หลัก (เช่น การสร้างเอกสาร) พัง
      // แต่บันทึก Error ไว้ตรวจสอบ
      this.logger.error(
        `Failed to process notification for user ${data.userId}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * ดึงรายการแจ้งเตือนของ User (สำหรับ Controller)
   */
  async findAll(userId: number, searchDto: SearchNotificationDto) {
    const { page = 1, limit = 20, isRead } = searchDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .take(limit)
      .skip(skip);

    // Filter by Read Status (ถ้ามีการส่งมา)
    if (isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead });
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    // นับจำนวนที่ยังไม่ได้อ่านทั้งหมด (เพื่อแสดง Badge ที่กระดิ่ง)
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
   * อ่านแจ้งเตือน (Mark as Read)
   */
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

      // Update Unread Count via WebSocket (Optional)
      // this.notificationGateway.sendUnreadCount(userId, ...);
    }
  }

  /**
   * อ่านทั้งหมด (Mark All as Read)
   */
  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  /**
   * ลบการแจ้งเตือนที่เก่าเกินกำหนด (ใช้กับ Cron Job Cleanup)
   * เก็บไว้ 90 วัน
   */
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
