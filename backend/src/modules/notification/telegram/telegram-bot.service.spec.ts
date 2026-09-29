// File: backend/src/modules/notification/telegram/telegram-bot.service.spec.ts
// Change Log:
// - 2026-09-25: Initial creation (Feature 258, T063) — FR-014 escape/truncate + FR-015 graceful-degradation assertions

import { TelegramBotService } from './telegram-bot.service';
import { TelegramSendError } from './telegram.errors';
import { TELEGRAM_MAX_MESSAGE_LENGTH } from './telegram.constants';

describe('TelegramBotService — FR-014 escape/truncate + FR-015 degrade', () => {
  describe('escapeHtml (parse_mode=HTML safety)', () => {
    it('escapes &, <, > in dynamic fields', () => {
      expect(TelegramBotService.escapeHtml('<b>RFA & "test"</b>')).toBe(
        '&lt;b&gt;RFA &amp; "test"&lt;/b&gt;'
      );
    });

    it('escapes ampersand before angle brackets (no double-escape)', () => {
      expect(TelegramBotService.escapeHtml('&lt;')).toBe('&amp;lt;');
    });

    it('leaves plain text untouched', () => {
      expect(TelegramBotService.escapeHtml('RFA-0001 รออนุมัติ')).toBe(
        'RFA-0001 รออนุมัติ'
      );
    });
  });

  describe('truncate (Telegram 4096-char limit)', () => {
    it('passes through text under the limit', () => {
      const text = 'x'.repeat(100);
      expect(TelegramBotService.truncate(text)).toBe(text);
    });

    it('truncates over-limit text with ellipsis at exactly 4096 chars', () => {
      const text = 'a'.repeat(TELEGRAM_MAX_MESSAGE_LENGTH + 500);
      const result = TelegramBotService.truncate(text);
      expect(result.length).toBe(TELEGRAM_MAX_MESSAGE_LENGTH);
      expect(result.endsWith('…')).toBe(true);
    });
  });

  describe('sendMessage graceful degradation (FR-015)', () => {
    // สร้าง instance แบบ manual — ทดสอบเฉพาะ early-exit path ที่ไม่แตะ axios/DB
    // settings: map key→value (ไม่มี key = unconfigured → fallback env ใน service)
    const buildService = (settings: Record<string, string>) => {
      const settingRepo = {
        findOne: jest.fn(({ where }: { where: { settingKey: string } }) => {
          const v = settings[where.settingKey];
          return Promise.resolve(
            v === undefined ? null : { settingValue: v, isEncrypted: false }
          );
        }),
      };
      const cryptoService = {
        isEncrypted: jest.fn().mockReturnValue(false),
        decrypt: jest.fn((v: string) => v),
      };
      const configService = { get: jest.fn().mockReturnValue(null) };
      const redis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn(),
        setnx: jest.fn(),
        pexpire: jest.fn(),
      };
      return new TelegramBotService(
        settingRepo as never,
        cryptoService as never,
        configService as never,
        redis as never
      );
    };

    it('throws permanent TELEGRAM_DISABLED when TELEGRAM_ENABLED=false — BullMQ must not retry', async () => {
      const service = buildService({ TELEGRAM_ENABLED: 'false' });
      await expect(service.sendMessage('123', 'hi')).rejects.toMatchObject({
        code: 'TELEGRAM_DISABLED',
        permanent: true,
      });
      await expect(service.sendMessage('123', 'hi')).rejects.toBeInstanceOf(
        TelegramSendError
      );
    });

    it('throws permanent BOT_TOKEN_MISSING when enabled but no token configured', async () => {
      const service = buildService({ TELEGRAM_ENABLED: 'true' });
      await expect(service.sendMessage('123', 'hi')).rejects.toMatchObject({
        code: 'BOT_TOKEN_MISSING',
        permanent: true,
      });
    });
  });
});
