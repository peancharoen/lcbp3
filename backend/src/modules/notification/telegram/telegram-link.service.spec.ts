// File: backend/src/modules/notification/telegram/telegram-link.service.spec.ts
// Change Log:
// - 2026-09-25: Initial creation (T016, RED) — unit tests สำหรับ TelegramLinkService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramBotService } from './telegram-bot.service';
import { User } from '../../user/entities/user.entity';
import { TELEGRAM_LINK_TTL_SECONDS } from './telegram.constants';

describe('TelegramLinkService (Feature 258 — US1)', () => {
  let service: TelegramLinkService;
  let mockRedis: Record<string, jest.Mock>;
  let mockUserRepo: Record<string, jest.Mock>;
  let mockBotService: Record<string, jest.Mock>;

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      user_id: 42,
      publicId: '019501a1-7c3e-7000-8000-abc123def456',
      username: 'somchai',
      telegramChatId: undefined,
      telegramUsername: undefined,
      telegramLinkedAt: undefined,
      ...overrides,
    }) as User;

  beforeEach(async () => {
    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };
    mockUserRepo = {
      findOne: jest.fn(),
      save: jest.fn((u: User) => Promise.resolve(u)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockBotService = {
      getBotUsername: jest.fn().mockResolvedValue('LCBP3DMSBot'),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      isEnabled: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramLinkService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: TelegramBotService, useValue: mockBotService },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<TelegramLinkService>(TelegramLinkService);
  });

  describe('issueLinkToken', () => {
    it('writes a single-use token to Redis with 900s TTL and returns a deep link', async () => {
      const user = makeUser();
      const result = await service.issueLinkToken(user);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^telegram:link:.+/),
        expect.stringContaining('"userId":42'),
        'EX',
        TELEGRAM_LINK_TTL_SECONDS,
        'NX'
      );
      expect(result.deepLink).toMatch(
        /^https:\/\/t\.me\/LCBP3DMSBot\?start=.+/
      );
      expect(result.expiresIn).toBe(TELEGRAM_LINK_TTL_SECONDS);
    });

    it('rejects when user is already linked (409 BusinessException)', async () => {
      const user = makeUser({ telegramChatId: '123456789' });
      await expect(service.issueLinkToken(user)).rejects.toMatchObject({
        httpStatus: 409,
      });
    });
  });

  describe('verifyAndBindUser', () => {
    const telegramUser = { id: 555777, username: 'somchai_tg' };

    it('binds chat id on valid token and deletes the Redis key (single-use)', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ userId: 42, userPublicId: 'x', iat: 1 })
      );
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      const bound = await service.verifyAndBindUser('tok123', telegramUser);

      expect(bound.telegramChatId).toBe('555777');
      expect(bound.telegramUsername).toBe('somchai_tg');
      expect(bound.telegramLinkedAt).toBeInstanceOf(Date);
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('telegram:link:tok123');
    });

    it('rejects expired/invalid token without writing to DB', async () => {
      mockRedis.get.mockResolvedValue(null);
      await expect(
        service.verifyAndBindUser('bad', telegramUser)
      ).rejects.toMatchObject({ httpStatus: 400 });
      expect(mockUserRepo.save).not.toHaveBeenCalled();
    });

    it('rejects when the chat id is already bound to a different user', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ userId: 42, userPublicId: 'x', iat: 1 })
      );
      mockUserRepo.findOne
        .mockResolvedValueOnce(makeUser()) // token owner
        .mockResolvedValueOnce(
          makeUser({ user_id: 99, telegramChatId: '555777' })
        ); // chat id owner

      await expect(
        service.verifyAndBindUser('tok123', telegramUser)
      ).rejects.toMatchObject({ httpStatus: 409 });
    });
  });

  describe('unlinkUser', () => {
    it('clears telegramChatId/telegramUsername/telegramLinkedAt', async () => {
      await service.unlinkUser(42);
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        { user_id: 42 },
        expect.objectContaining({
          telegramChatId: null,
          telegramUsername: null,
          telegramLinkedAt: null,
        })
      );
    });
  });
});
