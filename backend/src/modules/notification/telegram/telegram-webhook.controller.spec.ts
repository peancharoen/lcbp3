// File: backend/src/modules/notification/telegram/telegram-webhook.controller.spec.ts
// Change Log:
// - 2026-09-25: Initial creation (T019, RED) — webhook ingress tests (Feature 258 US1/US2)

import { Test, TestingModule } from '@nestjs/testing';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramLinkService } from './telegram-link.service';
import { NotificationChannelService } from '../notification-channel.service';
import { TelegramSecretGuard } from './telegram-secret.guard';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramUpdateDto } from './dto/telegram-update.dto';

const makeUpdate = (
  overrides: Partial<TelegramUpdateDto> = {}
): TelegramUpdateDto =>
  ({
    update_id: 1001,
    message: {
      message_id: 10,
      from: { id: 555777, username: 'somchai_tg' },
      chat: { id: 555777, type: 'private' },
      text: '/start tok123',
    },
    ...overrides,
  }) as TelegramUpdateDto;

describe('TelegramWebhookController (Feature 258)', () => {
  let controller: TelegramWebhookController;
  let mockRedis: Record<string, jest.Mock>;
  let mockLinkService: Record<string, jest.Mock>;
  let mockChannelService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
    };
    mockLinkService = {
      verifyAndBindUser: jest.fn().mockResolvedValue({ user_id: 42 }),
    };
    mockChannelService = {
      bindFromCode: jest.fn().mockResolvedValue({ name: 'LCBP3' }),
      handleBotRemoved: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramWebhookController],
      providers: [
        { provide: TelegramLinkService, useValue: mockLinkService },
        { provide: NotificationChannelService, useValue: mockChannelService },
        { provide: TelegramBotService, useValue: { sendMessage: jest.fn() } },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    })
      .overrideGuard(TelegramSecretGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TelegramWebhookController>(
      TelegramWebhookController
    );
  });

  it('handles /start <token> by binding the user', async () => {
    await controller.handleUpdate(makeUpdate());
    expect(mockLinkService.verifyAndBindUser).toHaveBeenCalledWith(
      'tok123',
      expect.objectContaining({ id: 555777 })
    );
  });

  it('deduplicates by update_id — second delivery short-circuits to 200', async () => {
    mockRedis.set
      .mockResolvedValueOnce('OK') // first: NX succeeds
      .mockResolvedValueOnce(null); // second: key exists

    await controller.handleUpdate(makeUpdate());
    await controller.handleUpdate(makeUpdate());

    expect(mockLinkService.verifyAndBindUser).toHaveBeenCalledTimes(1);
  });

  it('routes /link <code> in a group chat to channel binding with message_thread_id', async () => {
    const update = makeUpdate({
      message: {
        message_id: 11,
        from: { id: 555777 },
        chat: { id: -1001234567890, type: 'supergroup', title: 'LCBP3' },
        text: '/link CODE9',
        message_thread_id: 42,
      },
    } as Partial<TelegramUpdateDto>);

    await controller.handleUpdate(update);

    expect(mockChannelService.bindFromCode).toHaveBeenCalledWith(
      'CODE9',
      expect.objectContaining({
        externalChatId: '-1001234567890',
        telegramTopicId: 42,
        name: 'LCBP3',
      })
    );
  });

  it('handles my_chat_member left/kicked by marking the channel inactive', async () => {
    const update = makeUpdate({
      message: undefined,
      my_chat_member: {
        chat: { id: -1001234567890, type: 'supergroup', title: 'LCBP3' },
        from: { id: 1 },
        new_chat_member: { status: 'kicked' },
      },
    } as Partial<TelegramUpdateDto>);

    await controller.handleUpdate(update);

    expect(mockChannelService.handleBotRemoved).toHaveBeenCalledWith(
      '-1001234567890'
    );
  });
});

describe('TelegramSecretGuard (Feature 258)', () => {
  it('rejects missing/wrong secret header and accepts the correct one', async () => {
    const botService = {
      getWebhookSecret: jest.fn().mockResolvedValue('s3cret'),
    } as unknown as TelegramBotService;
    const guard = new TelegramSecretGuard(botService);

    const ctxWith = (header?: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: header
              ? { 'x-telegram-bot-api-secret-token': header }
              : {},
          }),
        }),
      }) as never;

    await expect(guard.canActivate(ctxWith())).resolves.toBe(false);
    await expect(guard.canActivate(ctxWith('wrong'))).resolves.toBe(false);
    await expect(guard.canActivate(ctxWith('s3cret'))).resolves.toBe(true);
  });
});
