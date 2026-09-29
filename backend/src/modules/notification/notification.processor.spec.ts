// File: backend/src/modules/notification/notification.processor.spec.ts
// Change Log:
// - 2026-09-25: Initial creation (T017, RED) — TELEGRAM dispatch leg unit tests (Feature 258)

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationProcessor } from './notification.processor';
import { TelegramBotService } from './telegram/telegram-bot.service';
import { TelegramSendError } from './telegram/telegram.errors';
import { NotificationChannelService } from './notification-channel.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { Job } from 'bullmq';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    user_id: 7,
    email: 'user@example.com',
    telegramChatId: '777888999',
    preference: {
      notifyEmail: true,
      notifyLine: true,
      notifyTelegram: true,
      digestMode: false,
    },
    ...overrides,
  }) as User;

const makeJob = (
  data: Record<string, unknown>
): Job<Record<string, unknown>, unknown, string> =>
  ({
    name: 'dispatch-notification',
    data,
    id: 'job-1',
  }) as Job<Record<string, unknown>, unknown, string>;

describe('NotificationProcessor — TELEGRAM leg (Feature 258)', () => {
  let processor: NotificationProcessor;
  let mockUserService: Record<string, jest.Mock>;
  let mockBotService: Record<string, jest.Mock>;
  let mockRedis: Record<string, jest.Mock>;
  let mockQueue: Record<string, jest.Mock>;

  const payload = {
    userId: 7,
    title: 'RFA Submitted',
    message: 'RFA RFA-001 submitted for approval.',
    type: 'TELEGRAM' as const,
    link: '/rfas/019501a1-7c3e-7000-8000-abc123def456',
    eventType: 'rfa.pending_approval',
    entityPublicId: '019501a1-7c3e-7000-8000-abc123def456',
  };

  beforeEach(async () => {
    mockUserService = { findOne: jest.fn().mockResolvedValue(makeUser()) };
    mockBotService = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      isEnabled: jest.fn().mockResolvedValue(true),
    };
    mockRedis = {
      rpush: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      lrange: jest.fn().mockResolvedValue([]),
      del: jest.fn(),
    };
    mockQueue = { add: jest.fn().mockResolvedValue({ id: 'digest-job' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: UserService, useValue: mockUserService },
        { provide: TelegramBotService, useValue: mockBotService },
        {
          provide: NotificationChannelService,
          useValue: { markInactive: jest.fn() },
        },
        {
          provide: NotificationDeliveryService,
          useValue: {
            record: jest.fn().mockResolvedValue({ publicId: 'del-uuid-1' }),
            markSent: jest.fn().mockResolvedValue(undefined),
            markFailed: jest.fn().mockResolvedValue(undefined),
            recordAttempt: jest.fn().mockResolvedValue(undefined),
            findByPublicId: jest.fn().mockResolvedValue(null),
          },
        },
        { provide: getQueueToken('notifications'), useValue: mockQueue },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
  });

  it('sends TELEGRAM DM immediately when notifyTelegram=true and digestMode=false', async () => {
    await processor.process(makeJob(payload));

    // DM: 2 args only — no messageThreadId (topic field is for group sends only)
    expect(mockBotService.sendMessage).toHaveBeenCalledWith(
      '777888999',
      expect.stringContaining('RFA')
    );
  });

  it('skips TELEGRAM send when notifyTelegram=false', async () => {
    mockUserService.findOne.mockResolvedValue(
      makeUser({
        preference: {
          notifyEmail: true,
          notifyLine: true,
          notifyTelegram: false,
          digestMode: false,
        },
      })
    );

    await processor.process(makeJob(payload));
    expect(mockBotService.sendMessage).not.toHaveBeenCalled();
  });

  it('skips TELEGRAM send when user has no telegramChatId', async () => {
    mockUserService.findOne.mockResolvedValue(
      makeUser({ telegramChatId: undefined })
    );
    await processor.process(makeJob(payload));
    expect(mockBotService.sendMessage).not.toHaveBeenCalled();
  });

  it('routes TELEGRAM through digest when digestMode=true (no immediate send)', async () => {
    mockUserService.findOne.mockResolvedValue(
      makeUser({
        preference: {
          notifyEmail: true,
          notifyLine: true,
          notifyTelegram: true,
          digestMode: true,
        },
      })
    );

    await processor.process(makeJob(payload));

    expect(mockRedis.rpush).toHaveBeenCalledWith(
      'digest:TELEGRAM:7',
      expect.any(String)
    );
    expect(mockBotService.sendMessage).not.toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalledWith(
      'process-digest',
      expect.objectContaining({ userId: 7, type: 'TELEGRAM' }),
      expect.objectContaining({ delay: expect.any(Number) })
    );
  });

  it('does NOT rethrow on permanent failure (bot blocked) — BullMQ must not retry', async () => {
    mockBotService.sendMessage.mockRejectedValue(
      new TelegramSendError('BOT_BLOCKED', 'Forbidden: bot was blocked', true)
    );

    await expect(processor.process(makeJob(payload))).resolves.not.toThrow();
    expect(mockBotService.sendMessage).toHaveBeenCalledTimes(1);
  });
});
