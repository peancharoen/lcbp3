// File: src/modules/notification/notification.processor.ts

import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';

interface NotificationPayload {
  userId: number;
  title: string;
  message: string;
  link: string;
  type: 'EMAIL' | 'LINE' | 'SYSTEM';
}

type NotificationJobData =
  | NotificationPayload
  | { userId: number; type: 'EMAIL' | 'LINE' };

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  private mailerTransport: nodemailer.Transporter;

  // ค่าคงที่สำหรับ Digest (เช่น รอ 5 นาที)
  private readonly DIGEST_DELAY = 5 * 60 * 1000;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    @InjectQueue('notifications') private notificationQueue: Queue,
    @InjectRedis() private readonly redis: Redis
  ) {
    super();
    // Setup Nodemailer
    this.mailerTransport = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<number>('SMTP_PORT')),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async process(
    job: Job<NotificationJobData, unknown, string>
  ): Promise<unknown> {
    this.logger.debug(`Processing job ${job.name} (ID: ${job.id})`);

    try {
      switch (job.name) {
        case 'dispatch-notification':
          return this.handleDispatch(job.data as NotificationPayload);

        case 'process-digest': {
          const data = job.data as { userId: number; type: 'EMAIL' | 'LINE' };
          return this.handleProcessDigest(data.userId, data.type);
        }

        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      // ✅ แก้ไขตรงนี้: Type Casting (error as Error)
      this.logger.error(
        `Failed to process job ${job.name}: ${(error as Error).message}`,
        (error as Error).stack
      );
      throw error; // ให้ BullMQ จัดการ Retry
    }
  }

  /**
   * ฟังก์ชันตัดสินใจ (Dispatcher)
   * ตรวจสอบ User Preferences และ Digest Mode
   */
  private async handleDispatch(data: NotificationPayload) {
    // 1. ดึง User พร้อม Preferences
    const user = await this.userService.findOne(data.userId);

    if (!user) {
      this.logger.warn(`User ${data.userId} not found, skipping notification.`);
      return;
    }

    const prefs = user.preference || {
      notifyEmail: true,
      notifyLine: true,
      digestMode: false,
    };

    // 2. ตรวจสอบว่า User ปิดรับการแจ้งเตือนหรือไม่
    if (data.type === 'EMAIL' && !prefs.notifyEmail) return;
    if (data.type === 'LINE' && !prefs.notifyLine) return;

    // 3. ตรวจสอบ Digest Mode
    if (prefs.digestMode) {
      await this.addToDigest(data);
    } else {
      // ส่งทันที (Real-time)
      if (data.type === 'EMAIL') await this.sendEmailImmediate(user, data);
      if (data.type === 'LINE') await this.sendLineImmediate(user, data);
    }
  }

  /**
   * เพิ่มข้อความลงใน Redis List และตั้งเวลาส่ง (Delayed Job)
   */
  private async addToDigest(data: NotificationPayload) {
    const key = `digest:${data.type}:${data.userId}`;

    // 1. Push ข้อมูลลง Redis List
    await this.redis.rpush(key, JSON.stringify(data));

    // 2. ตรวจสอบว่ามี "ตัวนับเวลาถอยหลัง" (Delayed Job) อยู่หรือยัง?
    const lockKey = `digest:lock:${data.type}:${data.userId}`;
    const isLocked = await this.redis.get(lockKey);

    if (!isLocked) {
      // ถ้ายังไม่มี Job รออยู่ ให้สร้างใหม่
      await this.notificationQueue.add(
        'process-digest',
        { userId: data.userId, type: data.type },
        {
          delay: this.DIGEST_DELAY,
          jobId: `digest-${data.type}-${data.userId}-${Date.now()}`,
        }
      );

      // Set Lock ไว้ตามเวลา Delay เพื่อไม่ให้สร้าง Job ซ้ำ
      await this.redis.set(lockKey, '1', 'PX', this.DIGEST_DELAY);
      this.logger.log(
        `Scheduled digest for User ${data.userId} (${data.type}) in ${this.DIGEST_DELAY}ms`
      );
    }
  }

  /**
   * ประมวลผล Digest (ส่งแบบรวม)
   */
  private async handleProcessDigest(userId: number, type: 'EMAIL' | 'LINE') {
    const key = `digest:${type}:${userId}`;
    const lockKey = `digest:lock:${type}:${userId}`;

    // 1. ดึงข้อความทั้งหมดจาก Redis และลบออกทันที
    const messagesRaw = await this.redis.lrange(key, 0, -1);
    await this.redis.del(key);
    await this.redis.del(lockKey); // Clear lock

    if (!messagesRaw || messagesRaw.length === 0) return;

    const messages: NotificationPayload[] = messagesRaw.map(
      (m) => JSON.parse(m) as NotificationPayload
    );
    const user = await this.userService.findOne(userId);

    if (type === 'EMAIL') {
      await this.sendEmailDigest(user, messages);
    } else if (type === 'LINE') {
      await this.sendLineDigest(user, messages);
    }
  }

  // =====================================================
  // SENDERS (Immediate & Digest)
  // =====================================================

  private async sendEmailImmediate(user: User, data: NotificationPayload) {
    if (!user.email) return;
    await this.mailerTransport.sendMail({
      from: '"LCBP3 DMS" <no-reply@np-dms.work>',
      to: user.email,
      subject: `[DMS] ${data.title}`,
      html: `<h3>${data.title}</h3><p>${data.message}</p><br/><a href="${data.link}">คลิกเพื่อดูรายละเอียด</a>`,
    });
    this.logger.log(`Email sent to ${user.email}`);
  }

  private async sendEmailDigest(user: User, messages: NotificationPayload[]) {
    if (!user.email) return;

    // สร้าง HTML List
    const listItems = messages
      .map(
        (msg) =>
          `<li><strong>${msg.title}</strong>: ${msg.message} <a href="${msg.link}">[View]</a></li>`
      )
      .join('');

    await this.mailerTransport.sendMail({
      from: '"LCBP3 DMS" <no-reply@np-dms.work>',
      to: user.email,
      subject: `[DMS Summary] คุณมีการแจ้งเตือนใหม่ ${messages.length} รายการ`,
      html: `
        <h3>สรุปรายการแจ้งเตือน (Digest)</h3>
        <ul>${listItems}</ul>
        <p>คุณได้รับอีเมลนี้เพราะเปิดใช้งานโหมดสรุปรายการ</p>
      `,
    });
    this.logger.log(
      `Digest Email sent to ${user.email} (${messages.length} items)`
    );
  }

  private async sendLineImmediate(user: User, data: NotificationPayload) {
    const n8nWebhookUrl = this.configService.get<string>(
      'N8N_LINE_WEBHOOK_URL'
    );
    if (!n8nWebhookUrl) return;

    try {
      await axios.post(n8nWebhookUrl, {
        userId: user.user_id,
        message: `${data.title}\n${data.message}`,
        link: data.link,
        isDigest: false,
      });
    } catch (error) {
      // ✅ แก้ไขตรงนี้ด้วย: Type Casting (error as Error)
      this.logger.error(`Line Error: ${(error as Error).message}`);
    }
  }

  private async sendLineDigest(user: User, messages: NotificationPayload[]) {
    const n8nWebhookUrl = this.configService.get<string>(
      'N8N_LINE_WEBHOOK_URL'
    );
    if (!n8nWebhookUrl) return;

    const summary = messages.map((m, i) => `${i + 1}. ${m.title}`).join('\n');

    try {
      await axios.post(n8nWebhookUrl, {
        userId: user.user_id,
        message: `สรุป ${messages.length} รายการใหม่:\n${summary}`,
        link: 'https://lcbp3.np-dms.work/notifications',
        isDigest: true,
      });
    } catch (error) {
      // ✅ แก้ไขตรงนี้ด้วย: Type Casting (error as Error)
      this.logger.error(`Line Digest Error: ${(error as Error).message}`);
    }
  }
}
