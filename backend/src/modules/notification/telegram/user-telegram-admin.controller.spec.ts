// File: backend/src/modules/notification/telegram/user-telegram-admin.controller.spec.ts
// Change Log:
// - 2026-09-25: Initial creation (T052) — force-unlink admin endpoint spec (Feature 258 US4, FR-018)

import { Test, TestingModule } from '@nestjs/testing';
import { UserTelegramAdminController } from './user-telegram-admin.controller';
import { TelegramLinkService } from './telegram-link.service';
import { NotificationService } from '../notification.service';
import { UserService } from '../../user/user.service';
import { User } from '../../user/entities/user.entity';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('UserTelegramAdminController (Feature 258 US4)', () => {
  let controller: UserTelegramAdminController;
  let linkService: { unlinkUser: jest.Mock };
  let userService: { findOneByUuid: jest.Mock };
  let notificationService: { send: jest.Mock };

  const admin = { user_id: 99, username: 'admin1' } as User;
  const target = {
    user_id: 7,
    publicId: 'user-uuid-7',
    telegramChatId: '777888999',
    telegramUsername: 'somchai',
  } as unknown as User;

  beforeEach(async () => {
    linkService = { unlinkUser: jest.fn().mockResolvedValue(undefined) };
    userService = { findOneByUuid: jest.fn().mockResolvedValue(target) };
    notificationService = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserTelegramAdminController],
      providers: [
        { provide: TelegramLinkService, useValue: linkService },
        { provide: UserService, useValue: userService },
        { provide: NotificationService, useValue: notificationService },
      ],
    })
      .overrideInterceptor(IdempotencyInterceptor)
      .useValue({
        intercept: (_ctx: ExecutionContext, next: CallHandler) => next.handle(),
      })
      .compile();

    controller = module.get(UserTelegramAdminController);
  });

  it('force-unlinks a bound user and notifies them via SYSTEM notification', async () => {
    const result = await controller.forceUnlink('user-uuid-7', admin);
    expect(result.status).toBe('unlinked');
    expect(linkService.unlinkUser).toHaveBeenCalledWith(7);
    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        type: 'SYSTEM',
        entityType: 'user',
      })
    );
  });

  it('returns not_linked without side effects when user has no binding', async () => {
    userService.findOneByUuid.mockResolvedValue({
      user_id: 8,
      publicId: 'user-uuid-8',
      telegramChatId: null,
    } as unknown as User);
    const result = await controller.forceUnlink('user-uuid-8', admin);
    expect(result.status).toBe('not_linked');
    expect(linkService.unlinkUser).not.toHaveBeenCalled();
    expect(notificationService.send).not.toHaveBeenCalled();
  });
});
