// File: backend/src/modules/notification/telegram/telegram-secret.guard.ts
// Change Log:
// - 2026-09-25: Initial creation — Guard ตรวจ X-Telegram-Bot-Api-Secret-Token header (Feature 258, research.md R4)

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { TelegramBotService } from './telegram-bot.service';

interface TelegramWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Guard สำหรับ Telegram webhook — ตรวจ `X-Telegram-Bot-Api-Secret-Token`
 * เทียบกับ `system_settings.TELEGRAM_WEBHOOK_SECRET` แบบ timing-safe
 * (endpoint นี้ไม่มี JWT — secret header คือ auth เดียว)
 */
@Injectable()
export class TelegramSecretGuard implements CanActivate {
  private readonly logger = new Logger(TelegramSecretGuard.name);

  constructor(private readonly telegramBotService: TelegramBotService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TelegramWebhookRequest>();
    const headerValue = request.headers['x-telegram-bot-api-secret-token'];
    const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    const expected = await this.telegramBotService.getWebhookSecret();
    if (!expected || !provided) {
      this.logger.warn('Telegram webhook rejected: missing secret');
      return false;
    }

    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    const matched =
      providedBuf.length === expectedBuf.length &&
      timingSafeEqual(providedBuf, expectedBuf);

    if (!matched) {
      this.logger.warn('Telegram webhook rejected: invalid secret');
    }
    return matched;
  }
}
