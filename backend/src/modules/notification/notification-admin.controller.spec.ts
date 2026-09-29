// File: backend/src/modules/notification/notification-admin.controller.spec.ts
// Change Log:
// - 2026-09-25: Initial creation (T051) — admin deliveries/settings endpoints spec (Feature 258 US4)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

import { NotificationAdminController } from './notification-admin.controller';
import { NotificationDeliveryService } from './notification-delivery.service';
import { TelegramBotService } from './telegram/telegram-bot.service';
import { SystemSetting } from '../ai/entities/system-setting.entity';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { NotificationType } from './entities/notification.entity';
import { DeliveryStatus } from './entities/notification-delivery.entity';
import { User } from '../user/entities/user.entity';

describe('NotificationAdminController (Feature 258 US4)', () => {
  let controller: NotificationAdminController;
  let deliveryService: { list: jest.Mock };
  let botService: { getMe: jest.Mock };
  let settingRepo: { find: jest.Mock; manager: { transaction: jest.Mock } };

  beforeEach(async () => {
    deliveryService = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    botService = {
      getMe: jest.fn().mockResolvedValue({ id: 1, username: 'lcbp3_bot' }),
    };
    settingRepo = {
      find: jest.fn().mockResolvedValue([]),
      manager: {
        transaction: jest.fn(async (cb: (m: unknown) => Promise<void>) => {
          const repo = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((x: object) => x),
            save: jest.fn().mockResolvedValue({}),
          };
          await cb({ getRepository: () => repo });
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationAdminController],
      providers: [
        { provide: NotificationDeliveryService, useValue: deliveryService },
        { provide: TelegramBotService, useValue: botService },
        { provide: getRepositoryToken(SystemSetting), useValue: settingRepo },
        { provide: getRedisConnectionToken(), useValue: { del: jest.fn() } },
      ],
    })
      .overrideInterceptor(IdempotencyInterceptor)
      .useValue({
        intercept: (_ctx: ExecutionContext, next: CallHandler) => next.handle(),
      })
      .compile();

    controller = module.get(NotificationAdminController);
  });

  it('GET deliveries passes filters to the service', async () => {
    await controller.listDeliveries(
      NotificationType.TELEGRAM,
      DeliveryStatus.FAILED,
      '777888999',
      '2026-09-01',
      '2026-09-25',
      '2',
      '25'
    );
    expect(deliveryService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        channelType: NotificationType.TELEGRAM,
        status: DeliveryStatus.FAILED,
        target: '777888999',
        page: 2,
        limit: 25,
      })
    );
  });

  it('GET settings never exposes token/secret values — only configured flags', async () => {
    settingRepo.find.mockResolvedValue([
      { settingKey: 'TELEGRAM_BOT_TOKEN', settingValue: 'secret-token-abc' },
      { settingKey: 'TELEGRAM_WEBHOOK_SECRET', settingValue: 'secret-xyz' },
      { settingKey: 'TELEGRAM_ENABLED', settingValue: 'true' },
      { settingKey: 'TELEGRAM_BOT_USERNAME', settingValue: 'lcbp3_bot' },
    ]);
    const result = await controller.getSettings();
    const json = JSON.stringify(result);
    expect(result.enabled).toBe(true);
    expect(result.botTokenConfigured).toBe(true);
    expect(result.botUsername).toBe('lcbp3_bot');
    expect(result.botReachable).toBe(true);
    // ค่า secret จริงต้องไม่รั่วใน response เด็ดขาด (FR-012)
    expect(json).not.toContain('secret-token-abc');
    expect(json).not.toContain('secret-xyz');
  });

  it('PATCH settings upserts TELEGRAM_ENABLED without exposing values', async () => {
    const admin = { user_id: 1 } as User;
    const result = await controller.patchSettings(admin, { enabled: false });
    expect(result).toEqual({ enabled: false });
    expect(settingRepo.manager.transaction).toHaveBeenCalled();
  });
});
