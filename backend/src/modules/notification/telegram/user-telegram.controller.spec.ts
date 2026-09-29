// File: backend/src/modules/notification/telegram/user-telegram.controller.spec.ts
// Change Log:
// - 2026-09-25: Initial creation (T018, RED→GREEN) — Telegram self-service endpoints (Feature 258)
//   Note: endpoints live on UserTelegramController (notification module) — not UserController —
//   to avoid UserModule↔NotificationModule circular dependency.

import { Test, TestingModule } from '@nestjs/testing';
import { UserTelegramController } from './user-telegram.controller';
import { TelegramLinkService } from './telegram-link.service';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { User } from '../../user/entities/user.entity';
import { CallHandler, ExecutionContext } from '@nestjs/common';

describe('UserTelegramController — self-service (Feature 258)', () => {
  let controller: UserTelegramController;
  let mockTelegramLink: Record<string, jest.Mock>;

  const user = {
    user_id: 42,
    publicId: 'u-uuid',
    telegramChatId: undefined,
    telegramUsername: undefined,
    telegramLinkedAt: undefined,
  } as User;

  beforeEach(async () => {
    mockTelegramLink = {
      issueLinkToken: jest.fn().mockResolvedValue({
        deepLink: 'https://t.me/LCBP3DMSBot?start=abc',
        expiresIn: 900,
      }),
      unlinkUser: jest.fn().mockResolvedValue(undefined),
      sendTestMessage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserTelegramController],
      providers: [{ provide: TelegramLinkService, useValue: mockTelegramLink }],
    })
      .overrideInterceptor(IdempotencyInterceptor)
      .useValue({
        intercept: (_ctx: ExecutionContext, next: CallHandler) => next.handle(),
      })
      .compile();

    controller = module.get<UserTelegramController>(UserTelegramController);
  });

  it('GET status returns linked=false when unbound', () => {
    const result = controller.getStatus(user);
    expect(result).toEqual({
      linked: false,
      telegramUsername: null,
      telegramLinkedAt: null,
    });
  });

  it('GET status returns linked=true with username/date when bound', () => {
    const linked = {
      ...user,
      telegramChatId: '555777',
      telegramUsername: 'somchai_tg',
      telegramLinkedAt: new Date('2026-09-25T10:00:00Z'),
    } as User;
    const result = controller.getStatus(linked);
    expect(result.linked).toBe(true);
    expect(result.telegramUsername).toBe('somchai_tg');
    // telegramChatId ต้องไม่รั่วออกมาใน response
    expect(
      (result as Record<string, unknown>)['telegramChatId']
    ).toBeUndefined();
  });

  it('POST link-token issues a deep link for the current user only', async () => {
    const result = await controller.issueLinkToken(user);
    expect(mockTelegramLink.issueLinkToken).toHaveBeenCalledWith(user);
    expect(result.deepLink).toContain('https://t.me/');
    expect(result.expiresIn).toBe(900);
  });

  it('DELETE unlinks the current user', async () => {
    const result = await controller.unlink(user);
    expect(mockTelegramLink.unlinkUser).toHaveBeenCalledWith(42);
    expect(result).toEqual({ status: 'unlinked' });
  });

  it('POST test-message sends a test DM to the current user', async () => {
    const result = await controller.sendTestMessage(user);
    expect(mockTelegramLink.sendTestMessage).toHaveBeenCalledWith(user);
    expect(result).toEqual({ status: 'sent' });
  });
});
