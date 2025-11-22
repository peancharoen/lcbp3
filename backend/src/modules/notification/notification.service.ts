import { Injectable, Logger } from '@nestjs/common';
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

// Interfaces
export interface NotificationJobData {
  userId: number;
  title: string;
  message: string;
  type: 'EMAIL' | 'LINE' | 'SYSTEM';
  entityType?: string; // e.g., 'rfa'
  entityId?: number; // e.g., rfa_id
  link?: string; // Deep link to frontend
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
   * ส่งการแจ้งเตือน (Trigger Notification)
   * ฟังก์ชันนี้จะตรวจสอบ Preference ของผู้ใช้ และ Push ลง Queue
   */
  async send(data: NotificationJobData) {
    try {
      // 1. สร้าง Entity Instance (ยังไม่บันทึกลง DB)
      // ใช้ Enum NotificationType.SYSTEM เพื่อให้ตรงกับ Type Definition
      const notification = this.notificationRepo.create({
        userId: data.userId,
        title: data.title,
        message: data.message,
        notificationType: NotificationType.SYSTEM,
        entityType: data.entityType,
        entityId: data.entityId,
        isRead: false,
      });

      // 2. บันทึกลง DB (ต้อง await เพื่อให้ได้ ID กลับมา)
      const savedNotification = await this.notificationRepo.save(notification);

      // 3. Real-time Push (ผ่าน WebSocket Gateway)
      // ส่งข้อมูลที่ save แล้ว (มี ID) ไปให้ Frontend
      this.notificationGateway.sendToUser(data.userId, savedNotification);

      // 4. ตรวจสอบ User Preferences เพื่อส่งช่องทางอื่น (Email/Line)
      const userPref = await this.userPrefRepo.findOne({
        where: { userId: data.userId },
      });

      // Default: ถ้าไม่มี Pref ให้ส่ง Email/Line เป็นค่าเริ่มต้น (true)
      const shouldSendEmail = userPref ? userPref.notifyEmail : true;
      const shouldSendLine = userPref ? userPref.notifyLine : true;

      const jobs = [];

      // 5. Push to Queue (Email)
      // เงื่อนไข: User เปิดรับ Email และ Type ของ Noti นี้ไม่ใช่ LINE-only
      if (shouldSendEmail && data.type !== 'LINE') {
        jobs.push({
          name: 'send-email',
          data: { ...data, notificationId: savedNotification.id },
          opts: {
            attempts: 3, // ลองใหม่ 3 ครั้งถ้าล่ม
            backoff: {
              type: 'exponential',
              delay: 5000, // รอ 5 วิ, 10 วิ, 20 วิ...
            },
          },
        });
      }

      // 6. Push to Queue (Line)
      // เงื่อนไข: User เปิดรับ Line และ Type ของ Noti นี้ไม่ใช่ EMAIL-only
      if (shouldSendLine && data.type !== 'EMAIL') {
        jobs.push({
          name: 'send-line',
          data: { ...data, notificationId: savedNotification.id },
          opts: {
            attempts: 3,
            backoff: { type: 'fixed', delay: 3000 },
          },
        });
      }

      if (jobs.length > 0) {
        await this.notificationQueue.addBulk(jobs);
      }

      this.logger.log(`Notification queued for user ${data.userId}`);
    } catch (error) {
      // Cast Error เพื่อให้ TypeScript ไม่ฟ้องใน Strict Mode
      this.logger.error(
        `Failed to queue notification: ${(error as Error).message}`,
      );
      // Note: ไม่ Throw error เพื่อไม่ให้กระทบ Flow หลัก (Resilience Pattern)
    }
  }

  /**
   * อ่านแจ้งเตือน (Mark as Read)
   */
  async markAsRead(id: number, userId: number) {
    await this.notificationRepo.update({ id, userId }, { isRead: true });
  }

  /**
   * อ่านทั้งหมด (Mark All as Read)
   */
  async markAllAsRead(userId: number) {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }
}
