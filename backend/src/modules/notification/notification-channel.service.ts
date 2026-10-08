// File: backend/src/modules/notification/notification-channel.service.ts
// Change Log:
// - 2026-09-25: Initial creation (T037, pulled forward for webhook controller dependency)
//   — project↔Telegram group/topic binding + notifyProject fan-out (Feature 258, FR-003/004/005)
// - 2026-10-06: User Grouping Model — เพิ่ม scope user_group/department + notifyUserGroup/notifyDepartment

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { In, IsNull, Repository } from 'typeorm';
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
import { UserGroup } from '../organization/entities/user-group.entity';
import { Department } from '../organization/entities/department.entity';
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
  /** Scope ของ channel ที่จะผูก — ต้องตั้ง 1 ค่าเสมอ (ไม่มี global scope) */
  projectId?: number;
  projectPublicId?: string;
  userGroupId?: number;
  departmentId?: number;
  name?: string;
  issuedBy: number;
  iat: number;
}

export interface GroupLinkCodeResult {
  code: string;
  expiresIn: number;
  projectPublicId?: string; // มีค่าเฉพาะเมื่อ scope = project (backward compat)
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
    @InjectRepository(UserGroup)
    private readonly userGroupRepo: Repository<UserGroup>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
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
    // Scope: ต้องระบุอย่างน้อย 1 ใน project/userGroup/department (และห้ามเกิน 1)
    const scopes = [
      dto.projectPublicId,
      dto.userGroupPublicId,
      dto.departmentPublicId,
    ].filter(Boolean);
    if (scopes.length !== 1) {
      throw new ValidationException(
        'Specify exactly one scope: projectPublicId, userGroupPublicId, or departmentPublicId',
        undefined,
        'กรุณาระบุ scope สำหรับผูก channel เพียง 1 อย่าง (โครงการ / กลุ่มผู้ใช้ / แผนก)'
      );
    }

    const payload: GroupLinkCodePayload = {
      name: dto.name,
      issuedBy: adminUserId,
      iat: Date.now(),
    };

    if (dto.projectPublicId) {
      const project = await this.projectRepo.findOne({
        where: { publicId: dto.projectPublicId },
      });
      if (!project) {
        throw new NotFoundException('Project', dto.projectPublicId);
      }
      payload.projectId = project.id;
      payload.projectPublicId = project.publicId;
    } else if (dto.userGroupPublicId) {
      const group = await this.userGroupRepo.findOne({
        where: { publicId: dto.userGroupPublicId },
      });
      if (!group) {
        throw new NotFoundException('UserGroup', dto.userGroupPublicId);
      }
      payload.userGroupId = group.id;
    } else if (dto.departmentPublicId) {
      const department = await this.departmentRepo.findOne({
        where: { publicId: dto.departmentPublicId },
      });
      if (!department) {
        throw new NotFoundException('Department', dto.departmentPublicId);
      }
      payload.departmentId = department.id;
    }

    const code = randomBytes(4).toString('hex').toUpperCase(); // 8 chars
    await this.redis.set(
      telegramGroupLinkKey(code),
      JSON.stringify(payload),
      'EX',
      TELEGRAM_GROUP_LINK_TTL_SECONDS,
      'NX'
    );

    this.logger.log(
      `Issued group link code by user ${adminUserId} (scope: project=${payload.projectId ?? '-'} group=${payload.userGroupId ?? '-'} dept=${payload.departmentId ?? '-'})`
    );
    return {
      code,
      expiresIn: TELEGRAM_GROUP_LINK_TTL_SECONDS,
      projectPublicId: payload.projectPublicId,
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
      userGroupId: payload.userGroupId,
      departmentId: payload.departmentId,
      name: ctx.name ?? payload.name,
      isActive: true,
      createdBy: payload.issuedBy,
    });
    const saved = await this.channelRepo.save(channel);
    await this.redis.del(key); // single-use

    this.logger.log(
      `Telegram channel bound: chat=${ctx.externalChatId} topic=${ctx.telegramTopicId ?? '-'} → project=${payload.projectPublicId ?? '-'} group=${payload.userGroupId ?? '-'} dept=${payload.departmentId ?? '-'}`
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
    return this.fanOut(channels, eventType, payload);
  }

  /** ส่ง event เข้าทุก active channel ที่ผูกกับ user group (claim-based fan-out) */
  async notifyUserGroup(
    userGroupId: number,
    eventType: string,
    payload: { text: string; entityType?: string; entityPublicId?: string }
  ): Promise<number> {
    const channels = await this.channelRepo.find({
      where: { userGroupId, isActive: true },
    });
    return this.fanOut(channels, eventType, payload);
  }

  /** ส่ง event เข้าทุก active channel ที่ผูกกับ department */
  async notifyDepartment(
    departmentId: number,
    eventType: string,
    payload: { text: string; entityType?: string; entityPublicId?: string }
  ): Promise<number> {
    const channels = await this.channelRepo.find({
      where: { departmentId, isActive: true },
    });
    return this.fanOut(channels, eventType, payload);
  }

  /** Fan-out ร่วม: สร้าง delivery row + enqueue ทีละ channel */
  private async fanOut(
    channels: NotificationChannel[],
    eventType: string,
    payload: { text: string; entityType?: string; entityPublicId?: string }
  ): Promise<number> {
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
      `Queued ${channels.length} Telegram group message(s) event=${eventType}`
    );
    return channels.length;
  }

  /** รายการ channels สำหรับ admin (filter ตาม project ได้) — resolve scope publicIds + ชื่อ scope ให้ UI */
  async list(projectPublicId?: string): Promise<NotificationChannel[]> {
    let channels: NotificationChannel[];
    if (!projectPublicId) {
      channels = await this.channelRepo.find({ order: { createdAt: 'DESC' } });
    } else {
      const project = await this.projectRepo.findOne({
        where: { publicId: projectPublicId },
      });
      if (!project) return [];
      channels = await this.channelRepo.find({
        where: { projectId: project.id },
        order: { createdAt: 'DESC' },
      });
    }
    // Resolve scope publicIds + scopeName สำหรับแสดงผล (column INT ถูก @Exclude ไม่ให้ expose)
    const projectIds = channels.map((c) => c.projectId).filter(Boolean);
    const groupIds = channels.map((c) => c.userGroupId).filter(Boolean);
    const deptIds = channels.map((c) => c.departmentId).filter(Boolean);
    const [projects, groups, departments] = await Promise.all([
      projectIds.length
        ? this.projectRepo.find({ where: { id: In(projectIds) } })
        : [],
      groupIds.length
        ? this.userGroupRepo.find({ where: { id: In(groupIds) } })
        : [],
      deptIds.length
        ? this.departmentRepo.find({ where: { id: In(deptIds) } })
        : [],
    ]);
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const deptMap = new Map(departments.map((d) => [d.id, d]));
    for (const channel of channels) {
      const project = channel.projectId
        ? projectMap.get(channel.projectId)
        : undefined;
      const group = channel.userGroupId
        ? groupMap.get(channel.userGroupId)
        : undefined;
      const department = channel.departmentId
        ? deptMap.get(channel.departmentId)
        : undefined;
      channel.projectPublicId = project?.publicId;
      channel.userGroupPublicId = group?.publicId;
      channel.departmentPublicId = department?.publicId;
      channel.scopeName =
        project?.projectName ?? group?.name ?? department?.departmentName;
    }
    return channels;
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
