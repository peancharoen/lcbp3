// File: backend/src/modules/notification/telegram/user-telegram.controller.ts
// Change Log:
// - 2026-09-25: Initial creation (T022) — Telegram self-service endpoints (Feature 258 US1/US3)

import {
  Controller,
  Post,
  Delete,
  Get,
  UseGuards,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { TelegramLinkService } from './telegram-link.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { User } from '../../user/entities/user.entity';

/**
 * Telegram self-service สำหรับ user ปัจจุบัน (owner-only — ไม่ต้อง permission พิเศษ)
 * Path: /users/me/telegram/* — อยู่ใน NotificationModule เพื่อเลี่ยง circular dep
 * กับ UserModule (NotificationModule import UserModule อยู่แล้ว)
 */
@ApiTags('Users — Telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/telegram')
export class UserTelegramController {
  constructor(private readonly telegramLinkService: TelegramLinkService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get my Telegram binding status' })
  getStatus(@CurrentUser() user: User) {
    return {
      linked: !!user.telegramChatId,
      telegramUsername: user.telegramUsername ?? null,
      telegramLinkedAt: user.telegramLinkedAt ?? null,
    };
  }

  @Post('link-token')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Issue a Telegram deep-link token (single-use, 15 min)',
  })
  issueLinkToken(@CurrentUser() user: User) {
    return this.telegramLinkService.issueLinkToken(user);
  }

  @Delete()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Unlink my Telegram binding' })
  async unlink(@CurrentUser() user: User) {
    await this.telegramLinkService.unlinkUser(user.user_id);
    return { status: 'unlinked' };
  }

  @Post('test-message')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a Telegram test message to myself' })
  async sendTestMessage(@CurrentUser() user: User) {
    await this.telegramLinkService.sendTestMessage(user);
    return { status: 'sent' };
  }
}
