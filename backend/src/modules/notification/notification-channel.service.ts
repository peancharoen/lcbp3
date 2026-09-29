// File: backend/src/modules/notification/notification-channel.service.ts
// Change Log:
// - 2026-09-25: Initial creation (T037, pulled forward for webhook controller dependency)
//   — project↔Telegram group/topic binding + notifyProject fan-out (Feature 258, FR-003/004/005)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { IsNull, Repository } from 'typeorm';
import type Redis from 'ioredis';
import type { Queue } from 'bullmq';
import { randomBytes } from 'crypto';

import {
  NotificationChannel,
  NotificationChannelType,
} from './entities/notification-channel.entity';
import {
  NotificationDelivery,
  DeliveryStatus,
} from './entities/notification-delivery.entity';
import { NotificationType } from './entities/notification.entity';
import { Project } from '../project/entities/project.entity';
import { LinkCodeRequestDto } from './telegram/dto/link-code-request.dto';
import {
  telegramGroupLinkKey,
  TELEGRAM_GROUP_LINK_TTL_SECONDS,
} from './telegram/telegram.constants';
import {
  QUEUE_NOTIFICATIONS,
  JOB_SEND_TELEGRAM_GROUP,
} from '../common/constants/queue.constants';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions';

interface GroupLinkCodePayload {
  projectId: number;
  projectPublicId: string;
  name?: string;
  issuedBy: number;
  iat: number;
}

export interface GroupLinkCodeResult {
  code: string;
  expiresIn: number;
  projectPublicId: string;
}

interface BindContext {
  externalChatId: string;
  telegramTopicId?: number;
  name?: string;
}

/** Payload ของ job ส่งข้อความเข้า group (data-model.md — BullMQ job data) */
export interface TelegramGroupJobData {
  deliveryId: string;
  chatId: string;
  messageThreadId: number | null;
  text: string;
  idempotencyKey: string;
}

/**
 * จัดการ notification_channels — binding ระหว่าง project ↔ Telegram group/forum topic
 * - `notifyProject()` broadcast event ไปทุก active channel ของ project (1:N, Clarification Q3)
 * - group post ส่ง real-time เสมอ — ไม่ผ่าน digest (Clarification Q2)
 */
@Injectable()
export class NotificationChannelService {
  private readonly logger = new Logger(NotificationChannelService.name);

  constructor(
    @InjectRepository(NotificationChannel)
    private readonly channelRepo: Repository<NotificationChannel>,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectQueue(QUEUE_NOTIFICATIONS) private readonly notificationQueue: Queue,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /**
   * Admin ออก one-time code ผูกกับ project — นำไปพิมพ์ `/link <code>` ใน Telegram
   */
  async issueLinkCode(
    adminUserId: number,
    dto: LinkCodeRequestDto
  ): Promise<GroupLinkCodeResult> {
    const project = await this.projectRepo.findOne({
      where: { publicId: dto.projectPublicId },
    });
    if (!project) {
      throw new NotFoundException('Project', dto.projectPublicId);
    }

    const code = randomBytes(4).toString('hex').toUpperCase(); // 8 chars
    const payload: GroupLinkCodePayload = {
      projectId: project.id,
      projectPublicId: project.publicId,
      name: dto.name,
      issuedBy: adminUserId,
      iat: Date.now(),
    };
    await this.redis.set(
      telegramGroupLinkKey(code),
      JSON.stringify(payload),
      'EX',
      TELEGRAM_GROUP_LINK_TTL_SECONDS,
      'NX'
    );

    this.logger.log(
      `Issued group link code for project ${dto.projectPublicId} by user ${adminUserId}`
    );
    return {
      code,
      expiresIn: TELEGRAM_GROUP_LINK_TTL_SECONDS,
      projectPublicId: project.publicId,
    };
  }

  /**
   * ผูก channel จาก `/link <code>` ใน Telegram — capture `message_thread_id` ถ้ามี (Forum Topics)
   * @throws ValidationException code ไม่ถูกต้อง/หมดอายุ
   * @throws ConflictException whole-group bind ซ้ำ (app-layer guard — MariaDB NULL ใน unique key ไม่ถือว่าซ้ำ)
   */
  async bindFromCode(
    code: string,
    ctx: BindContext
  ): Promise<NotificationChannel> {
    const key = telegramGroupLinkKey(code);
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new ValidationException(
        'Group link code invalid or expired',
        undefined,
        'รหัสผูกกลุ่มไม่ถูกต้องหรือหมดอายุแล้ว กรุณาสร้างรหัสใหม่จากหน้า admin'
      );
    }
    const payload = JSON.parse(raw) as GroupLinkCodePayload;

    // App-layer dedup: whole-group (topic=NULL) bind ซ้ำในกลุ่มเดียวกัน
    // (MariaDB ยอม NULL ซ้ำใน unique key — ledger known gap)
    const duplicateWhere: Record<string, unknown> = {
      channelType: NotificationChannelType.TELEGRAM_GROUP,
      externalChatId: ctx.externalChatId,
    };
    if (ctx.telegramTopicId === undefined || ctx.telegramTopicId === null) {
      duplicateWhere['telegramTopicId'] = IsNull();
    } else {
      duplicateWhere['telegramTopicId'] = ctx.telegramTopicId;
    }
    const duplicate = await this.channelRepo.findOne({ where: duplicateWhere });
    if (duplicate) {
      throw new ConflictException(
        'TELEGRAM_CHANNEL_ALREADY_BOUND',
        `Channel already bound: chat=${ctx.externalChatId} topic=${ctx.telegramTopicId ?? 'general'}`,
        'กลุ่ม/topic นี้ถูกผูกไว้แล้ว',
        ['ยกเลิกการผูกเดิมจากหน้า admin ก่อน']
      );
    }

    const channel = this.channelRepo.create({
      channelType: NotificationChannelType.TELEGRAM_GROUP,
      externalChatId: ctx.externalChatId,
      telegramTopicId: ctx.telegramTopicId ?? null,
      projectId: payload.projectId,
      name: ctx.name ?? payload.name,
      isActive: true,
      createdBy: payload.issuedBy,
    });
    const saved = await this.channelRepo.save(channel);
    await this.redis.del(key); // single-use

    this.logger.log(
      `Telegram channel bound: chat=${ctx.externalChatId} topic=${ctx.telegramTopicId ?? '-'} → project ${payload.projectPublicId}`
    );
    return saved;
  }

  /**
   * ส่ง event เข้าทุก active channel ของ project — สร้าง delivery row (PENDING)
   * แล้ว enqueue ทีละช่อง (ADR-008; ไม่ส่ง inline)
   */
  async notifyProject(
    projectId: number,
    eventType: string,
    payload: { text: string; entityType?: string; entityPublicId?: string }
  ): Promise<number> {
    const channels = await this.channelRepo.find({
      where: { projectId, isActive: true },
    });
    if (channels.length === 0) return 0;

    for (const channel of channels) {
      const delivery = await this.deliveryRepo.save(
        this.deliveryRepo.create({
          channelType: NotificationType.TELEGRAM,
          target: channel.externalChatId,
          channelId: channel.id,
          eventType,
          entityType: payload.entityType,
          entityId: payload.entityPublicId,
          status: DeliveryStatus.PENDING,
        })
      );

      const jobData: TelegramGroupJobData = {
        deliveryId: delivery.publicId,
        chatId: channel.externalChatId,
        messageThreadId: channel.telegramTopicId ?? null,
        text: payload.text,
        idempotencyKey: delivery.publicId,
      };
      const job = await this.notificationQueue.add(
        JOB_SEND_TELEGRAM_GROUP,
        jobData,
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
        }
      );
      await this.deliveryRepo.update(
        { publicId: delivery.publicId },
        { queuedJobId: job.id }
      );
    }

    this.logger.log(
      `Queued ${channels.length} Telegram group message(s) for project ${projectId} event=${eventType}`
    );
    return channels.length;
  }

  /** รายการ channels สำหรับ admin (filter ตาม project ได้) */
  async list(projectPublicId?: string): Promise<NotificationChannel[]> {
    if (!projectPublicId) {
      return this.channelRepo.find({ order: { createdAt: 'DESC' } });
    }
    const project = await this.projectRepo.findOne({
      where: { publicId: projectPublicId },
    });
    if (!project) return [];
    return this.channelRepo.find({
      where: { projectId: project.id },
      order: { createdAt: 'DESC' },
    });
  }

  /** อัปเดต name/is_active (reactivate หลังเชิญ bot กลับ) */
  async patch(
    publicId: string,
    data: { name?: string; isActive?: boolean }
  ): Promise<NotificationChannel> {
    const channel = await this.channelRepo.findOne({ where: { publicId } });
    if (!channel) throw new NotFoundException('NotificationChannel', publicId);
    if (data.name !== undefined) channel.name = data.name;
    if (data.isActive !== undefined) {
      channel.isActive = data.isActive;
      if (data.isActive) channel.lastError = null; // clear error เมื่อ reactivate
    }
    return this.channelRepo.save(channel);
  }

  /**
   * Hard-delete binding + app-level SET NULL บน deliveries (ไม่มี FK —
   * partitioned table; ดู contracts/telegram-api.md)
   */
  async delete(publicId: string): Promise<void> {
    const channel = await this.channelRepo.findOne({ where: { publicId } });
    if (!channel) throw new NotFoundException('NotificationChannel', publicId);
    // QueryDeepPartialEntity ตัด null ออกจาก type — ใช้ () => 'NULL' (raw SQL expr)
    // เพื่อสร้าง SET channel_id = NULL จริง
    await this.deliveryRepo.update(
      { channelId: channel.id },
      { channelId: () => 'NULL' }
    );
    await this.channelRepo.remove(channel);
    this.logger.log(`Telegram channel deleted: ${publicId}`);
  }

  /** bot ถูกเตะ/ออกจากกลุ่ม (my_chat_member) → mark inactive ทุก channel ของ chat นั้น */
  async handleBotRemoved(externalChatId: string): Promise<void> {
    const result = await this.channelRepo.update(
      { externalChatId, isActive: true },
      { isActive: false, lastError: 'BOT_REMOVED_FROM_CHAT' }
    );
    if ((result.affected ?? 0) > 0) {
      this.logger.warn(
        `Bot removed from chat ${externalChatId} — ${result.affected} channel(s) marked inactive`
      );
    }
  }

  /** ทำเครื่องหมาย channel ว่าส่งไม่ได้ (permanent failure จาก send leg) */
  async markInactive(channelId: number, error: string): Promise<void> {
    await this.channelRepo.update(
      { id: channelId },
      { isActive: false, lastError: error.slice(0, 255) }
    );
  }
}
