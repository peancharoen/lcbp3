// File: backend/src/modules/notification/telegram/telegram-webhook.controller.ts
// Change Log:
// - 2026-09-25: Initial creation (T023) — Telegram Bot webhook ingress (Feature 258, FR-001/003/010)

import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';

import { TelegramUpdateDto } from './dto/telegram-update.dto';
import { TelegramSecretGuard } from './telegram-secret.guard';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramBotService } from './telegram-bot.service';
import { NotificationChannelService } from '../notification-channel.service';
import {
  telegramWebhookDedupKey,
  TELEGRAM_WEBHOOK_DEDUP_TTL_SECONDS,
} from './telegram.constants';

/**
 * Telegram Bot webhook — public endpoint (auth = X-Telegram-Bot-Api-Secret-Token)
 * - ตอบ 200 ทันทีเสมอ (Telegram retry ถ้า timeout — dedup ด้วย update_id)
 * - จัดการเฉพาะ `message` (/start, /link) + `my_chat_member` (bot removed)
 * - งานหนัก defer — ห้ามทำงานหนักใน request thread (ADR-008)
 */
@Controller('notifications/telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly telegramLinkService: TelegramLinkService,
    private readonly channelService: NotificationChannelService,
    private readonly telegramBotService: TelegramBotService,
    @InjectRedis() private readonly redis: Redis
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @UseGuards(TelegramSecretGuard)
  async handleUpdate(@Body() update: TelegramUpdateDto): Promise<{ ok: true }> {
    // Idempotent ingress — Telegram retry update เดิมซ้ำได้
    const dedupKey = telegramWebhookDedupKey(update.update_id);
    const acquired = await this.redis.set(
      dedupKey,
      '1',
      'EX',
      TELEGRAM_WEBHOOK_DEDUP_TTL_SECONDS,
      'NX'
    );
    if (acquired === null) {
      this.logger.debug(`Duplicate update ${update.update_id} — skipped`);
      return { ok: true };
    }

    try {
      if (update.my_chat_member) {
        await this.handleMyChatMember(update);
      } else if (update.message?.text) {
        await this.handleMessage(update);
      }
    } catch (error) {
      // ไม่ให้ error รั่วออก — Telegram จะ retry ถ้าเราตอบไม่ใช่ 200
      this.logger.error(
        `Webhook update ${update.update_id} handling failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return { ok: true };
  }

  /** จัดการข้อความ — /start <token> (DM binding) และ /link <code> (group binding) */
  private async handleMessage(update: TelegramUpdateDto): Promise<void> {
    const message = update.message;
    if (!message?.text || !message.from) return;

    const text = message.text.trim();
    const [command, ...args] = text.split(/\s+/);
    const arg = args[0];

    if (command === '/start' && arg) {
      const user = await this.telegramLinkService.verifyAndBindUser(arg, {
        id: message.from.id,
        username: message.from.username,
        first_name: message.from.first_name,
      });
      await this.safeReply(
        message.chat.id,
        `✅ ผูกบัญชีสำเร็จ — LCBP3 DMS จะแจ้งเตือนคุณที่นี่ (linked as ${TelegramBotService.escapeHtml(message.from.username ?? `user ${user.user_id}`)})`
      );
      return;
    }

    if (command === '/link' && arg) {
      if (message.chat.type === 'private') {
        await this.safeReply(
          message.chat.id,
          'คำสั่ง /link ใช้ในกลุ่มเท่านั้น — ส่งใน Telegram group ที่ต้องการผูก'
        );
        return;
      }
      const channel = await this.channelService.bindFromCode(arg, {
        externalChatId: String(message.chat.id),
        telegramTopicId: message.message_thread_id,
        name: message.chat.title,
      });
      const scope = channel.telegramTopicId ? `topic นี้` : 'กลุ่มนี้';
      await this.safeReply(
        message.chat.id,
        `✅ ผูก${scope}กับโครงการสำเร็จ — การแจ้งเตือนระดับทีมจะส่งที่นี่`,
        channel.telegramTopicId ?? undefined
      );
      return;
    }

    // /start ไม่มี token หรือ command อื่น → ตอบกลับแบบ generic เท่านั้น
    if (command === '/start') {
      await this.safeReply(
        message.chat.id,
        'สวัสดี — บอทนี้ส่งการแจ้งเตือนจาก LCBP3 DMS\nผูกบัญชีได้ที่ โปรไฟล์ → การแจ้งเตือน ในระบบ DMS'
      );
    }
  }

  /** bot ถูกเตะ/ออกจากกลุ่ม → mark channels inactive (FR-010) */
  private async handleMyChatMember(update: TelegramUpdateDto): Promise<void> {
    const member = update.my_chat_member;
    if (!member) return;
    const status = member.new_chat_member?.status;
    if (status === 'left' || status === 'kicked') {
      await this.channelService.handleBotRemoved(String(member.chat.id));
    }
  }

  /** ตอบกลับใน Telegram — failure ไม่ทำให้ webhook fail */
  private async safeReply(
    chatId: number,
    text: string,
    messageThreadId?: number
  ): Promise<void> {
    try {
      await this.telegramBotService.sendMessage(
        String(chatId),
        text,
        messageThreadId
      );
    } catch (error) {
      this.logger.warn(
        `Webhook reply failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
