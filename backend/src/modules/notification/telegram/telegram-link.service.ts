// File: backend/src/modules/notification/telegram/telegram-link.service.ts
// Change Log:
// - 2026-09-25: Initial creation (T020) — user DM binding via deep-link /start token (Feature 258, FR-001/FR-006)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Repository } from 'typeorm';
import type Redis from 'ioredis';
import { randomBytes } from 'crypto';

import { User } from '../../user/entities/user.entity';
import { TelegramBotService } from './telegram-bot.service';
import {
  telegramLinkKey,
  TELEGRAM_LINK_TTL_SECONDS,
} from './telegram.constants';
import {
  ConflictException,
  ValidationException,
  BusinessException,
  NotFoundException,
} from '../../../common/exceptions';

interface LinkTokenPayload {
  userId: number;
  userPublicId: string;
  iat: number;
}

export interface TelegramLinkResult {
  deepLink: string;
  expiresIn: number;
}

/**
 * จัดการ binding ระหว่าง DMS user ↔ Telegram DM (deep-link /start <token>)
 * Token = single-use, TTL 900s, เก็บใน Redis เท่านั้น (ไม่เข้า DB)
 */
@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly telegramBotService: TelegramBotService,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /**
   * ออก deep-link token สำหรับ user ปัจจุบัน (Profile → Notifications)
   * @throws ConflictException (409) ถ้า user ผูกบัญชีอยู่แล้ว
   * @throws BusinessException (422) ถ้า bot ยังไม่ได้ configure
   */
  async issueLinkToken(user: User): Promise<TelegramLinkResult> {
    if (user.telegramChatId) {
      throw new ConflictException(
        'TELEGRAM_ALREADY_LINKED',
        `User ${user.user_id} already has a Telegram binding`,
        'บัญชีนี้ผูกกับ Telegram ไว้แล้ว',
        ['ยกเลิกการผูกเดิมก่อน (Unlink) แล้วสร้างลิงก์ใหม่']
      );
    }

    const botUsername = await this.telegramBotService.getBotUsername();
    if (!botUsername) {
      throw new BusinessException(
        'TELEGRAM_NOT_CONFIGURED',
        'TELEGRAM_BOT_USERNAME not configured',
        'ระบบแจ้งเตือน Telegram ยังไม่ได้ตั้งค่า',
        ['ติดต่อผู้ดูแลระบบ']
      );
    }

    const token = randomBytes(24).toString('hex');
    const payload: LinkTokenPayload = {
      userId: user.user_id,
      userPublicId: user.publicId,
      iat: Date.now(),
    };
    await this.redis.set(
      telegramLinkKey(token),
      JSON.stringify(payload),
      'EX',
      TELEGRAM_LINK_TTL_SECONDS,
      'NX'
    );

    this.logger.log(`Issued Telegram link token for user ${user.user_id}`);
    return {
      deepLink: `https://t.me/${botUsername}?start=${token}`,
      expiresIn: TELEGRAM_LINK_TTL_SECONDS,
    };
  }

  /**
   * ผูกบัญชีจาก /start <token> ที่ webhook ได้รับ
   * @throws ValidationException (400) token ไม่ถูกต้อง/หมดอายุ
   * @throws ConflictException (409) chat id นี้ผูกกับ user อื่นแล้ว
   */
  async verifyAndBindUser(
    token: string,
    telegramUser: { id: number; username?: string; first_name?: string }
  ): Promise<User> {
    const key = telegramLinkKey(token);
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new ValidationException(
        'Telegram link token invalid or expired',
        undefined,
        'ลิงก์ผูกบัญชีไม่ถูกต้องหรือหมดอายุแล้ว กรุณาสร้างลิงก์ใหม่จากหน้าโปรไฟล์'
      );
    }

    const payload = JSON.parse(raw) as LinkTokenPayload;
    const user = await this.userRepo.findOne({
      where: { user_id: payload.userId },
    });
    if (!user) {
      throw new NotFoundException('User', payload.userPublicId);
    }

    // 1 chat id = 1 DMS user (DB unique มีอยู่ แต่เช็ค app-level เพื่อ error ที่ชัดเจน)
    const chatId = String(telegramUser.id);
    const existing = await this.userRepo.findOne({
      where: { telegramChatId: chatId },
    });
    if (existing && existing.user_id !== user.user_id) {
      throw new ConflictException(
        'TELEGRAM_CHAT_ID_TAKEN',
        `Telegram chat ${chatId} is already bound to user ${existing.user_id}`,
        'บัญชี Telegram นี้ถูกผูกกับผู้ใช้อื่นแล้ว',
        [
          'เข้าสู่ระบบด้วยบัญชีที่ถูกต้อง หรือติดต่อผู้ดูแลระบบเพื่อยกเลิกการผูกเดิม',
        ]
      );
    }

    user.telegramChatId = chatId;
    user.telegramUsername = telegramUser.username;
    user.telegramLinkedAt = new Date();
    const saved = await this.userRepo.save(user);
    await this.redis.del(key); // single-use

    this.logger.log(`Telegram bound for user ${user.user_id}`);
    return saved;
  }

  /** ยกเลิกการผูก (self-service) — ล้างทั้ง 3 คอลัมน์ */
  async unlinkUser(userId: number): Promise<void> {
    await this.userRepo.update(
      { user_id: userId },
      {
        telegramChatId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      }
    );
    this.logger.log(`Telegram unlinked for user ${userId}`);
  }

  /** ส่งข้อความทดสอบ (FR-020) — throw BusinessException ถ้ายังไม่ผูก */
  async sendTestMessage(user: User): Promise<void> {
    if (!user.telegramChatId) {
      throw new BusinessException(
        'TELEGRAM_NOT_LINKED',
        `User ${user.user_id} has no Telegram binding`,
        'ยังไม่ได้ผูกบัญชี Telegram',
        ['ผูกบัญชีผ่านปุ่ม "เชื่อมต่อ Telegram" ก่อน']
      );
    }
    await this.telegramBotService.sendMessage(
      user.telegramChatId,
      '✅ <b>LCBP3 DMS</b> — ทดสอบการแจ้งเตือนสำเร็จ\nThis is a test message.'
    );
  }
}
