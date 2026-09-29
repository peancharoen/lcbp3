// File: backend/src/modules/notification/notification-admin.controller.ts
// Change Log:
// - 2026-09-25: Initial creation (T054) — admin deliveries audit + Telegram settings (Feature 258 US4, FR-019)

import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Repository } from 'typeorm';
import type Redis from 'ioredis';
import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import {
  NotificationDeliveryService,
  DeliveryListFilter,
} from './notification-delivery.service';
import { DeliveryStatus } from './entities/notification-delivery.entity';
import { NotificationType } from './entities/notification.entity';
import { TelegramBotService } from './telegram/telegram-bot.service';
import { SystemSetting } from '../ai/entities/system-setting.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { User } from '../user/entities/user.entity';

class PatchTelegramSettingsDto {
  @ApiProperty({ description: 'เปิด/ปิด Telegram notifications ทั้งระบบ' })
  @IsBoolean()
  enabled!: boolean;
}

const TELEGRAM_SETTINGS_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'TELEGRAM_ENABLED',
  'TELEGRAM_BOT_USERNAME',
];

/**
 * Admin observability endpoints (Feature 258)
 * — GET deliveries: audit trail ทุก send attempt (filter channelType/status/target/date)
 * — GET/PATCH settings: สถานะ bot แบบ masked (ไม่ส่ง token/secret จริงออก API เด็ดขาด — FR-012)
 */
@ApiTags('Admin — Notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationAdminController {
  constructor(
    private readonly deliveryService: NotificationDeliveryService,
    private readonly telegramBotService: TelegramBotService,
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    @InjectRedis() private readonly redis: Redis
  ) {}

  @Get('deliveries')
  @RequirePermission('notification.manage_all')
  @ApiOperation({ summary: 'List notification delivery audit rows' })
  async listDeliveries(
    @Query('channelType') channelType?: NotificationType,
    @Query('status') status?: DeliveryStatus,
    @Query('target') target?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const filter: DeliveryListFilter = {
      channelType,
      status,
      target,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
    const { items, total } = await this.deliveryService.list(filter);
    return {
      data: items,
      meta: { total, page: filter.page ?? 1, limit: filter.limit ?? 50 },
    };
  }

  /**
   * สถานะ Telegram config สำหรับ admin — masked เสมอ
   * คืนเฉพาะ configured/enabled flags + bot username (public อยู่แล้ว)
   */
  @Get('settings')
  @RequirePermission('notification.manage_all')
  @ApiOperation({ summary: 'Telegram settings status (masked — no secrets)' })
  async getSettings() {
    const settings = await this.settingRepo.find({
      where: TELEGRAM_SETTINGS_KEYS.map((key) => ({
        settingKey: key,
      })),
    });
    const byKey = new Map(settings.map((s) => [s.settingKey, s]));

    // bot getMe — แสดงว่า token ใช้งานได้จริงหรือไม่ (null = ไม่ได้ configure/ใช้ไม่ได้)
    const me = await this.telegramBotService.getMe();

    return {
      enabled: byKey.get('TELEGRAM_ENABLED')?.settingValue === 'true',
      botTokenConfigured: !!byKey.get('TELEGRAM_BOT_TOKEN')?.settingValue,
      webhookSecretConfigured: !!byKey.get('TELEGRAM_WEBHOOK_SECRET')
        ?.settingValue,
      botUsername: byKey.get('TELEGRAM_BOT_USERNAME')?.settingValue ?? null,
      botReachable: me !== null,
      botInfo: me ? { username: me.username } : null,
    };
  }

  /** เปิด/ปิด Telegram notifications ทั้งระบบ (TELEGRAM_ENABLED) */
  @Patch('settings')
  @RequirePermission('notification.manage_all')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Toggle Telegram notifications globally' })
  async patchSettings(
    @CurrentUser() user: User,
    @Body() dto: PatchTelegramSettingsDto
  ) {
    await this.settingRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(SystemSetting);
      const existing = await repo.findOne({
        where: { settingKey: 'TELEGRAM_ENABLED' },
      });
      const setting =
        existing ??
        repo.create({
          settingKey: 'TELEGRAM_ENABLED',
          dataType: 'boolean',
          category: 'notification',
          description: 'เปิด/ปิด Telegram notification channel ทั้งระบบ',
          isPublic: false,
        });
      setting.settingValue = String(dto.enabled);
      setting.updatedBy = user.user_id;
      await repo.save(setting);
    });
    // invalidate settings cache (prefix ใน TelegramBotService)
    await this.redis.del('system_settings:TELEGRAM_ENABLED');
    return { enabled: dto.enabled };
  }
}
