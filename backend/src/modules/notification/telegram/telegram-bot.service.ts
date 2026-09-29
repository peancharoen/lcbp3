// File: backend/src/modules/notification/telegram/telegram-bot.service.ts
// Change Log:
// - 2026-09-25: Initial creation — Telegram Bot API wrapper (axios direct, no SDK — research.md R1)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Repository } from 'typeorm';
import type Redis from 'ioredis';
import axios, { AxiosError } from 'axios';

import { SystemSetting } from '../../ai/entities/system-setting.entity';
import { CryptoService } from '../../../common/services/crypto.service';
import { TelegramSendError } from './telegram.errors';
import {
  telegramRateLimitKey,
  TELEGRAM_CHAT_PACING_MS,
  TELEGRAM_MAX_MESSAGE_LENGTH,
} from './telegram.constants';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const SETTING_BOT_TOKEN = 'TELEGRAM_BOT_TOKEN';
const SETTING_WEBHOOK_SECRET = 'TELEGRAM_WEBHOOK_SECRET';
const SETTING_ENABLED = 'TELEGRAM_ENABLED';
const SETTING_BOT_USERNAME = 'TELEGRAM_BOT_USERNAME';
const SETTINGS_CACHE_PREFIX = 'system_settings:';
const SETTINGS_CACHE_TTL_SECONDS = 30;

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

/**
 * Wrapper เบา ๆ สำหรับ Telegram Bot API — ไม่ใช้ SDK (research.md R1)
 * - token/secret อ่านจาก system_settings (decrypt ผ่าน CryptoService) fallback env
 * - per-chat pacing ผ่าน Redis (Telegram limit ~1 msg/s ต่อ chat)
 * - permanent errors (403 blocked / 400 chat not found) → TelegramSendError(permanent)
 */
@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /** Escape HTML สำหรับ dynamic fields ก่อนใส่ใน template (FR-014, parse_mode=HTML) */
  static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** ตัดข้อความให้ไม่เกิน Telegram limit 4096 chars (FR-014) — เผื่อ suffix '…' */
  static truncate(text: string, max = TELEGRAM_MAX_MESSAGE_LENGTH): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  /** ตรวจว่า Telegram channel เปิดใช้งานระดับ global หรือไม่ (TELEGRAM_ENABLED) */
  async isEnabled(): Promise<boolean> {
    const value = await this.getSetting(SETTING_ENABLED);
    return value === 'true';
  }

  /** Bot username สำหรับสร้าง deep link (ไม่มี @ นำหน้า) */
  async getBotUsername(): Promise<string | null> {
    return this.getSetting(SETTING_BOT_USERNAME);
  }

  /** Webhook secret สำหรับ guard ตรวจ header — อ่านจาก settings (อาจ encrypted) */
  async getWebhookSecret(): Promise<string | null> {
    return this.getSetting(SETTING_WEBHOOK_SECRET);
  }

  /**
   * ส่งข้อความ — DM (ไม่ใส่ messageThreadId) หรือ group/topic (ใส่ messageThreadId)
   * throw TelegramSendError เสมอเมื่อล้มเหลว — caller ตัดสินใจ retry/flag จาก `permanent`
   */
  async sendMessage(
    chatId: string,
    text: string,
    messageThreadId?: number
  ): Promise<void> {
    if (!(await this.isEnabled())) {
      throw new TelegramSendError(
        'TELEGRAM_DISABLED',
        'Telegram channel is disabled globally',
        true
      );
    }
    const token = await this.getBotToken();
    if (!token) {
      throw new TelegramSendError(
        'BOT_TOKEN_MISSING',
        'TELEGRAM_BOT_TOKEN not configured',
        true
      );
    }

    await this.paceChat(chatId);

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: TelegramBotService.truncate(text),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (messageThreadId !== undefined && messageThreadId !== null) {
      body.message_thread_id = messageThreadId;
    }

    try {
      await axios.post<TelegramApiResponse<unknown>>(
        `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
        body,
        { timeout: 10000 }
      );
      this.logger.debug(`Telegram message sent to chat ${chatId}`);
    } catch (error) {
      throw this.classifyError(error);
    }
  }

  /** ลงทะเบียน webhook กับ Telegram (ops flow — ครั้งเดียวต่อ environment) */
  async setWebhook(url: string, secretToken: string): Promise<boolean> {
    const token = await this.getBotToken();
    if (!token) {
      throw new TelegramSendError(
        'BOT_TOKEN_MISSING',
        'TELEGRAM_BOT_TOKEN not configured',
        true
      );
    }
    const res = await axios.post<TelegramApiResponse<boolean>>(
      `${TELEGRAM_API_BASE}/bot${token}/setWebhook`,
      {
        url,
        secret_token: secretToken,
        allowed_updates: ['message', 'my_chat_member'],
        drop_pending_updates: true,
      },
      { timeout: 10000 }
    );
    return res.data.ok === true;
  }

  /** ดึงข้อมูล bot (getMe) — ใช้แสดงสถานะใน admin settings page */
  async getMe(): Promise<{ id: number; username?: string } | null> {
    const token = await this.getBotToken();
    if (!token) return null;
    try {
      const res = await axios.get<
        TelegramApiResponse<{ id: number; username?: string }>
      >(`${TELEGRAM_API_BASE}/bot${token}/getMe`, { timeout: 10000 });
      return res.data.result ?? null;
    } catch (error) {
      this.logger.warn(
        `getMe failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /** อ่าน bot token — system_settings (decrypt) → fallback env TELEGRAM_BOT_TOKEN */
  private async getBotToken(): Promise<string | null> {
    const fromDb = await this.getSetting(SETTING_BOT_TOKEN);
    if (fromDb) return fromDb;
    return this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? null;
  }

  /**
   * อ่านค่า setting พร้อม Redis cache (30s) + decrypt ถ้า is_encrypted
   * — ไม่ log ค่าจริงเด็ดขาด
   */
  private async getSetting(key: string): Promise<string | null> {
    const cacheKey = `${SETTINGS_CACHE_PREFIX}${key}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) return cached === '' ? null : cached;
    } catch (error) {
      this.logger.warn(
        `Settings cache read failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const setting = await this.settingRepo.findOne({
      where: { settingKey: key },
    });
    let value: string | null = setting?.settingValue ?? null;
    if (value && setting?.isEncrypted) {
      value = this.cryptoService.decrypt(value);
    }

    try {
      await this.redis.set(
        cacheKey,
        value ?? '',
        'EX',
        SETTINGS_CACHE_TTL_SECONDS
      );
    } catch (error) {
      this.logger.warn(
        `Settings cache write failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return value;
  }

  /**
   * Per-chat pacing — ตั้ง key NX PX; ถ้า key มีอยู่ (เพิ่งส่งไป) รอตาม TTL ที่เหลือ
   * Global rate (~25 msg/s) ถูกคุมโดย BullMQ limiter บน worker อีกชั้น
   */
  private async paceChat(chatId: string): Promise<void> {
    const key = telegramRateLimitKey(chatId);
    try {
      const acquired = await this.redis.set(
        key,
        '1',
        'PX',
        TELEGRAM_CHAT_PACING_MS,
        'NX'
      );
      if (acquired === null) {
        const ttl = await this.redis.pttl(key);
        await this.sleep(ttl > 0 ? ttl : TELEGRAM_CHAT_PACING_MS);
      }
    } catch (error) {
      // Redis ล้ม → ข้าม pacing แล้วปล่อยให้ BullMQ limiter คุม (graceful degrade)
      this.logger.warn(
        `Chat pacing skipped (Redis error): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** แปลง Axios/Telegram error เป็น TelegramSendError พร้อม code + permanent flag */
  private classifyError(error: unknown): TelegramSendError {
    if (error instanceof AxiosError && error.response) {
      const status = error.response.status;
      const data = error.response.data as
        | TelegramApiResponse<unknown>
        | undefined;
      const description = data?.description ?? error.message;
      const retryAfter = data?.parameters?.retry_after;

      if (status === 403) {
        return new TelegramSendError('BOT_BLOCKED', description, true);
      }
      if (status === 400) {
        return new TelegramSendError('CHAT_NOT_FOUND', description, true);
      }
      if (status === 429) {
        return new TelegramSendError(
          'RATE_LIMITED',
          description,
          false,
          retryAfter
        );
      }
      return new TelegramSendError('API_ERROR', description, false);
    }
    const message = error instanceof Error ? error.message : String(error);
    return new TelegramSendError('API_ERROR', message, false);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
